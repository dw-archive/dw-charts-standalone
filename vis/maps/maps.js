
(function () {

    // Map
    // ---


    dw.visualization.register('maps', 'raphael-chart', {

        render: function(el) {
            var me = this;
            me.setRoot(el);

            // init datawrapper style for jquery.qtip
            $.fn.qtip.defaults.style.classes = 'ui-tooltip-datawrapper';

            if (me.map && me.get('map') == me.__lastSVG) {
                // it's enough to update the map
                me.updateMap();
                me.renderingComplete();
            } else {
                if (me.map) {
                    me._reset();
                } else {
                    me.notifications = [];
                }
                if (me.get('map') !== undefined && me.get('map-path') !== undefined) {
                    me.loadMap(el);
                }
            }
        },

        reset: function() {
            // we override reset() with an empty function because we
            // want to decide ourself whether or not we want to reset the map
            // e.g. if just the colors are changed we don't need to re-draw
            // the entire SVG dom but just adjust the colors..
        },

        /*
         * resets the initial map state in preparation of
         * a new rendering
         */
        _reset: function() {
            var me = this;
            me._localized_labels = undefined;
            me.map_meta = undefined;
            me.map.clear();
            $('#chart').html('').off('click').off('mousemove').off('mouseenter').off('mouseover');
            $('.chart .filter-ui').remove();
            $('.chart .legend').remove();
        },

        /**
        * Return the path for svg file.
        */
        getSVG: function() {
            var me = this;
            return 'assets/' + me.get('map-path') + "/map.svg";
        },

        /*
         * called by render() whenever a new map needs to be loaded
         */
        loadMap: function(el) {
            var me = this,
                c = me.__initCanvas({}),
                $map = $('<div id="map"></div>').html('').appendTo(el),
                map_path = me.get('map-path');

            /**
            * Parse and return the map's json
            */
            function getMapMeta() {
                return $.getJSON('assets/' + map_path + "/map.json")
                    .done(function(res) { me.map_meta = res; });
            }

            /*
             * return the dict which contains all the labels in current locale
             */
            function getLabelJSON() {
                var mapOpt = _.find(me.meta.options.map.options, function(m) {
                    return m['path'] == map_path;
                });
                if (mapOpt.has_locale) {
                    return $.getJSON('assets/' + map_path + '/locale.json')
                        .done(function(res) {
                            me._all_locales = res;
                            var loc = me.chart().locale().slice(0,2);
                            if (res[loc]) me._localized_labels = res[loc];
                        });
                }
                return false;
            }

            // initialize kartograph instance
            me.map = kartograph.map($map, c.w-10);
            me.__lastSVG = me.get('map');

            $.when(
                me.map.load(me.getSVG()),
                getMapMeta(),
                getLabelJSON()

            ).done(function(r0, r1) {
                // Loops over layers and adds it into map
                var layers = _.pairs(r1[0].layers); // make copy

                nextLayer();

                // hide map until the rendering is done
                me.__root.css('opacity', 0);

                /*
                 * asynchronously adds another layer to the map
                 * if all layers are added, proceed() is called
                 */
                function nextLayer() {
                    if (layers.length) {
                        var l = layers.shift();
                        l[1].name = l[0];
                        l[1].key = 'key';
                        l[1].chunks = 50;
                        l[1].done = nextLayer;
                        me.map.addLayer(l[1].src, l[1]);
                    } else {
                        proceed();
                    }
                }

                /*
                 * called after all layers have been rendered
                 */
                function proceed() {
                    // hide map until the rendering is done
                    me.__root.css('opacity', 1);
                    if (me.map_meta.options) {
                        $.extend(me.map.opts, me.map_meta.options);
                    }

                    me.updateMap();

                    // binds mouse events
                    me.map.getLayer('layer0').tooltips(_.bind(me.tooltip, me));

                    // mark visualization as rendered
                    me.renderingComplete();
                }
            });

        },

        /*
         * called by render() whenever the map config changed
         * this resizes the map and updates the colors
         */
        updateMap: function() {
            var me = this,
                reverseAlias = getReverseAliases(),
                highlighted = me.get('highlighted-series', []),
                data = [];

            // resize map
            me.data = getData();

            // colorize
            me.scale = colorByNumbers() ? eval(me.get('gradient.chromajs-constructor')) :
                (function() {
                    //              v-- cloning custom colors to avoid override
                    var catColors = $.extend({}, me.get('custom-colors', {})),
                        colors = me.theme().colors.categories[me.get('category-color-preset', 0)], // use first set of colors defined in theme for now
                        num_colors = colors.length,
                        pos = 0;
                    return function(cat) {
                        if (!catColors[cat]) {
                            catColors[cat] = colors[pos % num_colors];
                            pos++;
                        }
                        return chroma.hex(catColors[cat]);
                    };
                })();

            if (!me.scale) {
                // fallback to red color scheme, should not happen
                me.scale = chroma.scale('Reds');
            }

            me.map.getLayer('layer0').style({
                fill: fill,
                stroke: function(pd) {
                    var color = fill(pd);
                    if (startsWith(color, "url(")) {
                        color = null;
                    }
                    return chroma.hex(color || '#ccc').darken(25).hex();
                }
            }, 0, 0);
            // show scale
            me.showLegend(me.scale);

            me.map.getLayer('layer0').sort(function(pd) {
                // sort paths by fill lumincane, so darker paths are on top (outline looks better then)
                var color = pd.__last_fill;
                if (startsWith(color, "url(")) {
                    color = null;
                }
                return chroma.hex(color || '#ccc').luminance() * -1;
            });

            // remove any previous symbols
            try { me.map.removeSymbols(); } catch (e) {}

            if (highlighted.length > 0) {
                // add text labels for highlighted elements
                me.map.addSymbols({
                    type: $K.HtmlLabel,
                    // only show labels for paths that exist in our map
                    data: _.filter(highlighted, function(key) {
                        return me.data[key] || me.data[reverseAlias[key]];
                    }),
                    // by default, the path centroid is used as label position
                    // however, this can be changed by defining a custom-center
                    // in map.json (see North America example map)
                    location: function(key) {
                        if (!me.data[key] && reverseAlias[key]) key = reverseAlias[key];
                        if (me.map_meta['custom-center'] && me.map_meta['custom-center'][key]) {
                            // use custom center
                            return me.map_meta['custom-center'][key];
                        }
                        // use centroid of region
                        return 'layer0.'+key;
                    },
                    // show both label and the formatted value as text
                    text: function(key) {
                        if (!me.data[key] && reverseAlias[key]) key = reverseAlias[key];
                        return me.data[key].label+'<br/>'+me.formatValue(me.data[key].value, true);
                    },
                    // make sure the label is readable against the paths color
                    // also add some buffer using text-shadow
                    css: function(key) {
                        if (!me.data[key] && reverseAlias[key]) key = reverseAlias[key];
                        var fill = chroma.hex(me.data[key].color).luminance() > 0.5 ? '#000' : '#fff';
                        var css = {
                            color: fill,
                            'font-size': '13px',
                            'line-height': '15px',
                            'text-shadow': ('0 1px 0 %, 1px 0 0 %, 0 -1px 0 %, -1px 0 0 %,'+
                                '1px 1px 0 %, 1px -1px 0 %, -1px -1px 0 %, -1px 1px 0 %,'+
                                '0 2px 1px %, 2px 0 1px %, 0 -2px 1px %, -2px 0 1px %,'+
                                '-1px 2px 0px %, 2px -1px 0px %, -1px -2px 0px %, -2px -1px 0px %,'+
                                '1px 2px 0px %, 2px 1px 0px %, 1px -2px 0px %, -2px 1px 0px %')
                                    .replace(/%/g, me.data[key].color)
                        };
                        return css;
                    }
                });

                // once the label symbols are added we need to add another
                // invisible layer for catching the mouse events
                // before we do so we need to remove the layer if it exists already
                if (me.map.layers['tooltip-target']) {
                    me.map.getLayer('tooltip-target').remove();
                    me.map.getLayer('tooltip-target').paper.remove();
                    delete me.map.layers['tooltip-target'];
                }

                // now add the invisible layer for catching the mouse events
                me.map.addLayer('layer0', {
                    name: 'tooltip-target',
                    styles: {
                        stroke: false,
                        fill: '#fff',
                        opacity: 0
                    },
                    tooltips: _.bind(me.tooltip, me),
                    add_svg_layer: true
                });
            }

            me.keyLabel = getLabel;

            /*
             * returns the fill color (as hex string) for
             * the given path data.
             */
            function fill(path_data) {
                if (path_data === undefined || (path_data === null)) return false;

                var data = me.data[path_data['key']],
                    no_data_color = "url('"+window.__dw.vis.meta.__static_path + 'stripped.png'+"')";

                if (data !== undefined) {
                    var color;
                    if (_.isNumber(data.raw) || !colorByNumbers()) {
                        if ($.isFunction(me.scale)) {
                            color = me.scale(data.raw) ? me.scale(data.raw).hex() : '#f00';
                        } else {
                            color = '#ccc';
                        }
                        data.color = color;
                        path_data.__last_fill = color;
                        return data.color;
                    }
                }
                return no_data_color;
            }

            /*
             * returns true if the data column is numeric
             */
            function colorByNumbers() {
                return me.axes(true).color.type() == 'number';
            }

            /*
             * returns the reverse key aliases for the map
             * they are used to maximize the likelyhood that
             * we identify the map paths by their id
             */
            function getReverseAliases() {
                var rev = {};
                _.each(me.map_meta.keys, function(key) {
                    if (me.map_meta['alias-keys']) {
                        _.each(me.map_meta['alias-keys'], function(alias) {
                            if (alias[key]) rev[alias[key]] = key;
                        });
                    }
                    if (me._localized_labels && me._localized_labels[key]) {
                        rev[me._localized_labels[key]] = key;
                    }
                    if (me._all_locales) {
                        _.each(me._all_locales, function(labels) {
                            if (labels[key]) rev[labels[key]] = key;
                        });
                    }
                });
                return rev;
            }

            function getKeyCandidates(key) {
                var keys = [key];
                if (me.map_meta['alias-keys']) {
                    _.each(me.map_meta['alias-keys'], function(alias) {
                        if (alias[key]) {
                            keys.push(alias[key]);
                        }
                    });
                }
                if (me._all_locales) {
                    _.each(me._all_locales, function(labels) {
                        if (labels[key]) keys.push(labels[key]);
                    });
                }
                return keys;
            }

            /*
             * Loops into svg's paths, filter the given data to
             * keep only related data.
             * @return {Array}
             */
            function getData() {
                var data = getDataSeries(),
                    filtered = {},
                    paths = me.map.getLayer('layer0').paths,
                    pathIDs = [],
                    found = 0;

                _.each(paths, function(path){
                    var key = path.data['key'],
                        keys = getKeyCandidates(key); // list of potential keys
                    pathIDs.push(key);
                    _.some(keys, function(k) {
                        if (data[k]) {
                            filtered[key] = data[k];
                            found++;
                            return true;
                        }
                        return false;
                    });
                });

                var missing_percent = 1 - found / paths.length;
                if (missing_percent > 0.4) {
                    // if no notification, we create one
                    if (me.notifications['ids-mismatching'] === undefined) {
                        var template_ds = dw.dataset([
                                dw.column('ID', pathIDs, 'text'),
                                dw.column('Label', _.map(pathIDs, function(k) {
                                    return getLabel(k);
                                }), 'text'),
                                dw.column('Value', _.times(pathIDs.length, function() {
                                    return _.random(0, Math.random() < 0.2 ? 1000 : 500);
                                }), 'number')
                            ]),
                            template_csv = 'data:application/octet-stream;charset=utf-8,' +
                            encodeURIComponent(template_ds.toCSV()).replace(/'/g, '%27');
                        me.notifications['ids-mismatching'] = me.notify(
                            me.translate("ids-mismatching")
                              .replace("%d", (missing_percent*100).toFixed(0)+'%')
                              .replace("%t", template_csv),
                        "ids-mismatching");
                    }
                } else {
                    // remove notification if exists
                    if (me.notifications['ids-mismatching']) {
                        me.notifications['ids-mismatching'].fadeOutAndRemove();
                        delete me.notifications['ids-mismatching'];
                    }
                }
                return filtered;
            }

            /*
             * returns the displayed label for a given key
             * looks up the translated region names in locale.json
             * and falls back to the label stored with the svg map
             */
            function getLabel(key) {
                // Load from <map-path>/locale/<lang>.json
                var layer0 = me.map.getLayer('layer0');
                if (me._localized_labels && me._localized_labels[key]) {
                    // yeah, we have a translated label
                    return me._localized_labels[key];
                }
                if (layer0) {
                    var paths = layer0.getPaths({key: key.toString() });
                    if (paths.length && paths[0].data.label) {
                        // use the label stored in the svg map
                        return paths[0].data.label;
                    }
                    if (reverseAlias[key]) {
                        // try again with a different key (if present)
                        return getLabel(reverseAlias[key]);
                    }
                }
                return key;
            }

            /*
             * This function return the data as:
             * Array(geo_code_as_key => {raw:, value:})
             * value is the raw formated.
             * @return {Array}
             */
            function getDataSeries() {
                var data = {},
                    keyColumn = me.axes(true).keys,
                    valueColumn = me.axes(true).color;
                _.each(keyColumn.raw(), function (geo_code, index) {
                    var value = colorByNumbers() ? valueColumn.val(index) : valueColumn.raw(index);
                    data[geo_code] = {};
                    data[geo_code].raw = value;
                    data[geo_code].label = getLabel(geo_code);
                    if (_.isNull(value)) {
                        data[geo_code].value = "n/a";
                    } else {
                        data[geo_code].value = me.formatValue(value, true);
                    }
                });
                return data;
            }

        }, // end updateMap

        /*
         * resizes the map so that the map fits into the
         * chart area.
         */
        resizeMap: function(w, h) {
            var me = this,
                view = me.map.layers.layer0.view,
                ratio = view.height / view.width,
                winH = me.__h;
            h = Math.min(h, winH);
            if (me.__lastH && me.__lastH == h && me.__lastW == w) {
                // if the size hasn't changed, there is no need for action
                return;
            }
            me.__lastH = h;
            me.__lastW = w;
            $('#map').css({ height: h });  // update size of map container
            me.map.resize(w, h);
        },

        /*
         * add the map legend
         */
        showLegend: function(scale) {
            // remove old legend
            var me = this,
                $legend = $('#chart .scale, #chart .legend').remove();

            if (me.axes(true).color.type() != 'number') {
                // show category legend
                var lvalues = [];
                $legend = $("<div />").addClass('legend');
                _.each(_.unique(me.axes(true).color.values()), function(val) {
                    var d = $('<div />')
                        .html(val)
                        .css({ 'border-left-color': me.scale(val) })
                        .addClass('legend-item')
                        .appendTo($legend);

                    // add hover effect to highlight regions
                    d.hover(function mouseover(e) {
                        function o(pd) {
                            return me.data[pd.key] && me.data[pd.key].raw == val ? 1 : 0.1;
                        }
                        if (me.map.layers['bg']) {
                            me.map.getLayer('bg').style('opacity', o);
                        }
                        me.map.getLayer('layer0').style('opacity', o);
                    }, function mouseout() {
                        me.map.getLayer('layer0').style('opacity', 1);
                        if (me.map.layers['bg']) {
                            me.map.getLayer('bg').style('opacity', 1);
                        }
                    });
                });
                $('#map').before($legend);
            } else {
                // show legend for numeric data
                $legend = $("<div />").addClass('scale');
                var domains = scale.domain(),
                    legend_size = Math.min(Math.max(Math.min(300, me.__w), me.__w*0.6), 500),
                    domains_delta = domains[domains.length-1] - domains[0],
                    offset = 0,
                    max_height = 0,
                    size_by_value = true,
                    label_size = 0;

                $legend.css("width", legend_size);

                _.each(domains, function(step, i) {
                    if (i > 0) {
                        if ((domains[i] - domains[i-1]) / domains_delta * legend_size < 20) {
                            size_by_value = false;
                        }
                    }
                });

                var roundedDomains = dw.utils.smartRound(domains, 1);

                _.each(domains, function(step, index) {
                    // for each segment, we adding a domain in the legend and a sticker
                    if (index < domains.length - 1) {
                        var delta = domains[index+1] - step,
                            color = scale(step),
                            label = me.formatValue(roundedDomains[index], index == domains.length-2),
                            size = size_by_value ? delta / domains_delta * legend_size
                                    : legend_size / (domains.length-1),
                            // setting step
                            $step = $("<div class='step'></div>"),
                            $sticker = $("<span class='sticker'></span>").appendTo($legend);

                        $step.css({width: size, 'background-color': color.hex() });
                        // settings ticker
                        $sticker.css('left', offset);
                        if (step.toString().split('.')[1] && step.toString().split('.')[1].length > 2){
                            step = Globalize.format(step, 'n');
                        }
                        if (index > 0) {
                            label_size += size;
                            if (label_size < 30) {
                               label = '';
                            } else {
                                label_size = 0;
                            }
                            $('<div />')
                                .addClass('value')
                                .html(label)
                                .appendTo($sticker);
                        } else {
                            $sticker.remove();
                        }
                        // add hover effect to highlight regions
                        $step.hover(function(e) {
                            var stepColor = chroma.color($(e.target).css('background-color')).hex();
                            function o(pd) {
                                return me.data[pd.key] && me.data[pd.key].color == stepColor ? 1 : 0.1;
                            }
                            if (me.map.layers['bg']) {
                                me.map.getLayer('bg').style('opacity', o);
                            }
                            me.map.getLayer('layer0').style('opacity', o);
                        }, function() {
                            me.map.getLayer('layer0').style('opacity', 1);
                            if (me.map.layers['bg']) {
                                me.map.getLayer('bg').style('opacity', 1);
                            }
                        });
                        $legend.append($step);
                        offset += size;
                    }
                });
                // title
                $("<div />")
                    .addClass('scale_title label')
                    .attr('data-column', me.axes().color)
                    .attr('data-row', -1)
                    .html('<span>'+me.axes(true).color.title()+'</span>')
                    .prependTo($legend);
                $('#map').after($legend);
            }
            var h = $legend.outerHeight(true);
            me.resizeMap(me.__w, me.__h - h);
        },

        getStickersMaxWidth: function ($scale) {
            var max = 0;
            _.each($scale.find('.sticker'), function (sticker) {
                max = Math.max(max, $(sticker).outerWidth(false));
            });
            return max;
        },

        tooltip: function(data, path, event) {
            var me = this;
            if (me.data[data['key']] === undefined) { return false; }
            return [
                me.data[data['key']].label,
                me.data[data['key']].value
            ];
        },

        /** useful for thumbnail generation */
        __initCanvas: function(canvas) {
            var me = this;
            canvas = _.extend({
                w: me.__w,
                h: me.__h,
                rpad: me.theme().padding.right,
                lpad: me.theme().padding.left,
                bpad: me.theme().padding.bottom,
                tpad: me.theme().padding.top
            }, canvas);
            me.__canvas = canvas;
            return canvas;
        },

        keys: function() {
            var me = this;
            return me.axes(true).keys.values();
        },

        /*
         * Return the label for the given path key.
         * If the translation doens't exist in the <map>/locale/<lang>.json file,
         * The label is retrieved in the svg file at the 'data-label' field.
         */
        keyLabel: function(key) {
            return key;
        },

        formatValue: function() {
            var me = this;
            // we're overwriting this function with the actual column formatter
            // when it is first called (lazy evaluation)
            me.formatValue = me.chart().columnFormatter(me.axes(true).color);
            return me.formatValue.apply(me, arguments);
        },

        // tell the template that we are smart enough to re-render the map
        supportsSmartRendering: function() {
            return true;
        },

        _svgCanvas: function() {
            if (!this.map || !this.map.layers || !this.map.layers.layer0) return null;
            return this.map.layers.layer0.paper.canvas;
        }

    });

    function startsWith(str, starts){
      if (starts === '') return true;
      if (str === null || starts === null) return false;
      str = String(str); starts = String(starts);
      return str.length >= starts.length && str.slice(0, starts.length) === starts;
    }

}).call(this);