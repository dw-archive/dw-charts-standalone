//
// NOTE: This file is auto-generated using /dw.js/make
// from the source files /dw.js/src/*.js.
//
// If you want to change anything you need to change it
// in the source files and then re-run /dw.js/make, or
// otherwise your changes will be lost on the make.
//

(function(){

    var root = this,
        dw = {};

    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = dw;
        }
        exports.dw = dw;
    } else {
        window.dw = dw;
    }

/*
 * Dataset class
 */
dw.dataset = function(columns, opts) {

    // make column names unique
    var columnsByName = {},
        origColumns = columns.slice(0);
    _.each(columns, function(col) {
        uniqueName(col);
        columnsByName[col.name()] = col;
    });

    opts = _.extend(opts, {  });

    // sets a unique name for a column
    function uniqueName(col) {
        var origColName = col.name(),
            colName = origColName,
            appendix = 1;

        while (columnsByName.hasOwnProperty(colName)) {
            colName = origColName+'.'+(appendix++);
        }
        if (colName != origColName) col.name(colName); // rename column
    }


    // public interface
    var dataset = {

        columns: function() {
            return columns;
        },

        column: function(x) {
            if (_.isString(x)) {
                // single column by name
                if (columnsByName[x] !== undefined) return columnsByName[x];
                throw 'No column found with that name: "'+x+'"';
            }
            // single column by index
            if (columns[x] !== undefined) return columns[x];
            throw 'No column found with that index: '+x;
        },

        numColumns: function() {
            return columns.length;
        },

        numRows: function() {
            return columns[0].length;
        },

        eachColumn: function(func) {
            _.each(columns, func);
        },

        hasColumn: function(x) {
            return (_.isString(x) ? columnsByName[x] : columns[x]) !== undefined;
        },

        indexOf: function(column_name) {
            if (!dataset.hasColumn(column_name)) return -1;
            return _.indexOf(columns, columnsByName[column_name]);
        },

        toCSV: function() {
            var csv = "",
                sep = ",",
                quote = "\"";
            // add header
            _.each(columns, function(col, i) {
                var t = col.title();
                if (t.indexOf(quote) > -1) t.replace(quote, '\\'+quote);
                if (t.indexOf(sep) > -1) t = quote + t + quote;
                csv += (i > 0 ? sep : '') + t;
            });
            // add values
            _.each(_.range(dataset.numRows()), function(row) {
                csv += '\n';
                _.each(columns, function(col, i) {
                    var t = ''+(col.type() == 'date' ? col.raw(row) : col.val(row));
                    if (t.indexOf(quote) > -1) t.replace(quote, '\\'+quote);
                    if (t.indexOf(sep) > -1) t = quote + t + quote;
                    csv += (i > 0 ? sep : '') + t;
                });
            });
            return csv;
        },

        /*
         * removes ignored columns from dataset
         */
        filterColumns: function(ignore) {
            columns = _.filter(columns, function(c) {
                return !ignore[c.name()];
            });
            _.each(ignore, function(ign, key) {
                if (ign && columnsByName[key]) delete columnsByName[key];
            });
            return dataset;
        },

        /*
         * executes func for each row of the dataset
         */
        eachRow: function(func) {
            var i;
            for (i=0; i<dataset.numRows(); i++) {
                func(i);
            }
            return dataset;
        },

        /*
         * adds a new column to the dataset
         */
        add: function(column) {
            uniqueName(column);
            columns.push(column);
            columnsByName[column.name()] = column;
            return dataset;
        },

        reset: function() {
            columns = origColumns.slice(0);
            columnsByName = {};
            _.each(columns, function(col) {
                columnsByName[col.name()] = col;
            });
            return dataset;
        }

    };
    return dataset;
};


/*
 * DataColumn abstracts the functionality of each column
 * of a dataset. A column has a type (text|number|date).
 *
 * API:
 *
 * column.name() ... returns the name (string)
 * column.type() ... return column type (string)
 * column.length ... number of rows (number)
 * column.val(i) ... parsed value in row i
 * column.each(func) ... apply function to each value
 * column.raw() ... access raw, unparsed values
 *
 */
dw.column = function(name, rows, type) {

    function guessType(sample) {

        if (_.every(rows, _.isNumber)) return dw.column.types.number();
        if (_.every(rows, _.isDate)) return dw.column.types.date();
        // guessing column type by counting parsing errors
        // for every known type
        var types = [
                dw.column.types.date(sample),
                dw.column.types.number(sample),
                dw.column.types.text()
            ],
            type,
            k = rows.length,
            tolerance = 0.1; // allowing 10% mis-parsed values

        _.each(rows, function(val) {
            _.each(types, function(t) {
                t.parse(val);
            });
        });
        _.every(types, function(t) {
            if (t.errors() / k < tolerance) type = t;
            return !type;
        });
        return type;
    }

    // we pick random 100 values for column type testing
    var sample = _.map(_.shuffle(_.range(rows.length)).slice(0, 200), function(i) { return rows[i]; });

    type = type ? dw.column.types[type](sample) : guessType(sample);

    var range,
        total,
        origRows = rows.slice(0),
        title;

    // public interface
    var column = {
        // column name (used for reference in chart metadata)
        name: function() {
            if (arguments.length) {
                name = arguments[0];
                return column;
            }
            return dw.utils.purifyHtml(name);
        },

        // column title (used for presentation)
        title: function() {
            if (arguments.length) {
              title = arguments[0];
              return column;
            }
            return dw.utils.purifyHtml(title || name);
        },

        /**
         * number of rows
         */
        length: rows.length,

        /**
         * returns ith row of the col, parsed
         *
         * @param i
         * @param unfiltered  if set to true, precedent calls of filterRows are ignored
         */
        val: function(i, unfiltered) {
            if (!arguments.length) return undefined;
            var r = unfiltered ? origRows : rows;
            if (i < 0) i += r.length;
            return type.parse(dw.utils.purifyHtml(r[i]));
        },

        /*
         * returns an array of parsed values
         */
        values: function(unfiltered) {
            var r = unfiltered ? origRows : rows;
            r = _.map(r, dw.utils.purifyHtml);
            return _.map(r, type.parse);
        },

        /**
         * apply function to each value
         */
        each: function(f) {
            for (i=0; i<rows.length; i++) {
                f(column.val(i), i);
            }
        },

        // access to raw values
        raw: function(i, val) {
            if (!arguments.length) return rows;
            if (arguments.length == 2) {
                rows[i] = val;
                return column;
            }
            return dw.utils.purifyHtml(rows[i]);
        },

        /**
         * if called with no arguments, this returns the column type name
         * if called with true as argument, this returns the column type (as object)
         * if called with a string as argument, this sets a new column type
         */
        type: function(o) {
            if (o === true) return type;
            if (_.isString(o)) {
                if (dw.column.types[o]) {
                    type = dw.column.types[o](sample);
                    return column;
                } else {
                    throw 'unknown column type: '+o;
                }
            }
            return type.name();
        },

        // [min,max] range
        range: function() {
            if (!type.toNum) return false;
            if (!range) {
                range = [Number.MAX_VALUE, -Number.MAX_VALUE];
                column.each(function(v) {
                    v = type.toNum(v);
                    if (!_.isNumber(v) || _.isNaN(v)) return;
                    if (v < range[0]) range[0] = v;
                    if (v > range[1]) range[1] = v;
                });
                range[0] = type.fromNum(range[0]);
                range[1] = type.fromNum(range[1]);
            }
            return range;
        },
        // sum of values
        total: function() {
            if (!type.toNum) return false;
            if (!total) {
                total = 0;
                column.each(function(v) {
                    total += type.toNum(v);
                });
                total = type.fromNum(total);
            }
            return total;
        },
        // remove rows from column, keep those whose index
        // is within @r
        filterRows: function(r) {
            rows = [];
            if (arguments.length) {
                _.each(r, function(i) {
                    rows.push(origRows[i]);
                });
            } else {
                rows = origRows.slice(0);
            }
            column.length = rows.length;
            // invalidate range and total
            range = total = false;
            return column;
        },

        toString: function() {
            return name + ' ('+type.name()+')';
        },

        indexOf: function(val) {
            return _.find(_.range(rows.length), function(i) {
                return column.val(i) == val;
            });
        }
    };
    return column;
};

dw.column.types = {};


dw.column.types.text = function() {
    return {
        parse: _.identity,
        errors: function() { return 0; },
        name: function() { return 'text'; },
        formatter: function() { return _.identity; },
        isValid: function() { return true; },
        format: function() { }
    };
};

/*
 * A type for numbers:
 *
 * Usage:
 * var parse = dw.type.number(sampleData);
 * parse()
 */
dw.column.types.number = function(sample) {

    function signDigitsDecimalPlaces(num, sig) {
        if (num === 0) return 0;
        return Math.round( sig - Math.ceil( Math.log( Math.abs( num ) ) / Math.LN10 ) );
    }

    var format,
        errors = 0,
        knownFormats = {
            '-.': /^ *-?[0-9]*(\.[0-9]+)?(e[\+\-][0-9]+) *$/,
            '-,': /^ *-?[0-9]*(,[0-9]+)? *$/,
            ',.': /^ *-?[0-9]{1,3}(,[0-9]{3})*(\.[0-9]+)? *$/,
            '.,': /^ *-?[0-9]{1,3}(\.[0-9]{3})*(,[0-9]+)? *$/,
            ' .': /^ *-?[0-9]{1,3}( [0-9]{3})*(\.[0-9]+)? *$/,
            ' ,': /^ *-?[0-9]{1,3}( [0-9]{3})*(,[0-9]+)? *$/,
            // excel sometimes produces a strange white-space:
            ' .': /^ *-?[0-9]{1,3}( [0-9]{3})*(\.[0-9]+)? *$/,
            ' ,': /^ *-?[0-9]{1,3}( [0-9]{3})*(,[0-9]+)? *$/
        },
        formatLabels = {
            '-.': '1234.56',
            '-,': '1234,56',
            ',.': '1,234.56',
            '.,': '1.234,56',
            ' .': '1 234.56',
            ' ,': '1 234,56',
            // excel sometimes produces a strange white-space:
            ' .': '1 234.56',
            ' ,': '1 234,56'
        },
        // a list of strings that are recognized as 'not available'
        naStrings = {
            'na': 1,
            'n/a': 1,
            '-': 1,
            ':': 1
        };

    var matches = {},
        bestMatch = ['-.', 0];

    sample = sample || [];

    _.each(sample, function(n) {
        _.each(knownFormats, function(regex, fmt) {
            if (matches[fmt] === undefined) matches[fmt] = 0;
            if (regex.test(n)) {
                matches[fmt] += 1;
                if (matches[fmt] > bestMatch[1]) {
                    bestMatch[0] = fmt;
                    bestMatch[1] = matches[fmt];
                }
            }
        });
    });
    format = bestMatch[0];

    // public interface
    var type = {
        parse: function(raw) {
            if (_.isNumber(raw) || _.isUndefined(raw) || _.isNull(raw)) return raw;
            var number = raw;
            // normalize number
            if (format[0] != '-') {
                // remove kilo seperator
                number = number.replace(format[0], '');
            }
            if (format[1] != '.') {
                // replace decimal char w/ point
                number = number.replace(format[1], '.');
            }

            if (isNaN(number) || number === "") {
                if (!naStrings[number.toLowerCase()] && number !== "") errors++;
                return raw;
            }
            return Number(number);
        },
        toNum: function(i) { return i; },
        fromNum: function(i) { return i; },
        errors: function() { return errors; },
        name: function() { return 'number'; },

        // returns a function for formatting numbers
        formatter: function(config) {
            var format = config['number-format'] || '-',
                div = Number(config['number-divisor'] || 0),
                append = (config['number-append'] || '').replace(/ /g, '\u00A0'),
                prepend = (config['number-prepend'] || '').replace(/ /g, '\u00A0');

            return function(val, full, round) {
                if (isNaN(val)) return val;
                var _fmt = format;
                if (div !== 0 && _fmt == '-') _fmt = 'n1';
                if (div !== 0) val = Number(val) / Math.pow(10, div);
                if (_fmt.substr(0,1) == 's') {
                    // significant figures
                    var sig = +_fmt.substr(1);
                    _fmt = 'n'+Math.max(0, signDigitsDecimalPlaces(val, sig));
                }
                if (round) _fmt = 'n0';
                val = Globalize.format(val, _fmt != '-' ? _fmt : null);
                return full ? prepend + val + append : val;
            };
        },

        isValid: function(val) {
            return val === "" || naStrings[String(val).toLowerCase()] || _.isNumber(type.parse(val));
        },

        ambiguousFormats: function() {
            var candidates = [];
            _.each(matches, function(cnt, fmt) {
                if (cnt == bestMatch[1]) {
                    candidates.push([fmt, formatLabels[fmt]]); // key, label
                }
            });
            return candidates;
        },

        format: function(fmt) {
            if (arguments.length) {
                format = fmt;
                return type;
            }
            return format;
        }
    };
    return type;
};


/*
 * type for date values, e.g. 2004 Q1
 */
dw.column.types.date = function(sample) {

    var format,
        errors = 0,
        matches = {},
        bestMatch = ['', 0],
        knownFormats = {
            // each format has two regex, a strict one for testing and a lazy one for parsing
            'YYYY': {
                test: /^ *(?:1[7-9]|20)\d{2} *$/,
                //parse: /^ *((?:1[7-9]|20)\d{2}) *$/,
                parse: /^ *(\d{4}) *$/,
                precision: 'year'
            },
            'YYYY-H': {
                test: /^ *[12]\d{3}[ \-\/]?[hH][12] *$/,
                parse: /^ *(\d{4})[ \-\/]?[hH]([12]) *$/,
                precision: 'half'
            },
            'H-YYYY': {
                test: /^ *[hH][12][ \-\/][12]\d{3} *$/,
                parse: /^ *[hH]([12])[ \-\/](\d{4}) *$/,
                precision: 'half'
            },
            'YYYY-Q': {
                test: /^ *[12]\d{3}[ \-\/]?[qQ][1234] *$/,
                parse: /^ *(\d{4})[ \-\/]?[qQ]([1234]) *$/,
                precision: 'quarter'
            },
            'Q-YYYY': {
                test: /^ *[qQ]([1234])[ \-\/][12]\d{3} *$/,
                parse: /^ *[qQ]([1234])[ \-\/](\d{4}) *$/,
                precision: 'quarter'
            },
            'YYYY-M': {
                test: /^ *([12]\d{3}) ?[ \-\/\.mM](0?[1-9]|1[0-2]) *$/,
                parse: /^ *(\d{4}) ?[ \-\/\.mM](0?[1-9]|1[0-2]) *$/,
                precision: 'month'
            },
            'M-YYYY': {
                test: /^ *(0?[1-9]|1[0-2]) ?[ \-\/\.][12]\d{3} *$/,
                parse: /^ *(0?[1-9]|1[0-2]) ?[ \-\/\.](\d{4}) *$/,
                precision: 'month'
            },
            'YYYY-WW': {
                test: /^ *[12]\d{3}[ -]?[wW](0?[1-9]|[1-4]\d|5[0-3]) *$/,
                parse: /^ *(\d{4})[ -]?[wW](0?[1-9]|[1-4]\d|5[0-3]) *$/,
                precision: 'week'
            },
            'MM/DD/YYYY': {
                test: /^ *(0?[1-9]|1[0-2])([\-\/] ?)(0?[1-9]|[1-2]\d|3[01])\2([12]\d{3})$/,
                parse: /^ *(0?[1-9]|1[0-2])([\-\/] ?)(0?[1-9]|[1-2]\d|3[01])\2(\d{4})$/,
                precision: 'day'
            },
            'DD/MM/YYYY': {
                test: /^ *(0?[1-9]|[1-2]\d|3[01])([\-\.\/ ?])(0?[1-9]|1[0-2])\2([12]\d{3})$/,
                parse: /^ *(0?[1-9]|[1-2]\d|3[01])([\-\.\/ ?])(0?[1-9]|1[0-2])\2(\d{4})$/,
                precision: 'day'
            },
            'YYYY-MM-DD': {
                test: /^ *([12]\d{3})([\-\/\. ?])(0?[1-9]|1[0-2])\2(0?[1-9]|[1-2]\d|3[01])$/,
                parse: /^ *(\d{4})([\-\/\. ?])(0?[1-9]|1[0-2])\2(0?[1-9]|[1-2]\d|3[01])$/,
                precision: 'day'
            },
            'YYYY-WW-d': { // year + ISO week + [day]
                test: /^ *[12]\d{3}[ \-]?[wW](0?[1-9]|[1-4]\d|5[0-3])(?:[ \-]?[1-7]) *$/,
                parse: /^ *(\d{4})[ \-]?[wW](0?[1-9]|[1-4]\d|5[0-3])(?:[ \-]?([1-7])) *$/,
                precision: 'day'
            },
            // dates with a time
            'MM/DD/YYYY HH:MM': {
                test: /^ *(0?[1-9]|1[0-2])([-\/] ?)(0?[1-9]|[1-2]\d|3[01])\2([12]\d{3}) *[ \-\|] *(0?\d|1\d|2[0-3]):([0-5]\d) *$/,
                parse: /^ *(0?[1-9]|1[0-2])([-\/] ?)(0?[1-9]|[1-2]\d|3[01])\2(\d{4}) *[ \-\|] *(0?\d|1\d|2[0-3]):([0-5]\d) *$/,
                precision: 'day-minutes'
            },
            'DD.MM.YYYY HH:MM': {
                test: /^ *(0?[1-9]|[1-2]\d|3[01])([-\.\/ ?])(0?[1-9]|1[0-2])\2([12]\d{3}) *[ \-\|] *(0?\d|1\d|2[0-3]):([0-5]\d) *$/,
                parse: /^ *(0?[1-9]|[1-2]\d|3[01])([-\.\/ ?])(0?[1-9]|1[0-2])\2(\d{4}) *[ \-\|] *(0?\d|1\d|2[0-3]):([0-5]\d) *$/,
                precision: 'day-minutes'
            },
            'YYYY-MM-DD HH:MM': {
                test: /^ *([12]\d{3})([-\/\. ?])(0?[1-9]|1[0-2])\2(0?[1-9]|[1-2]\d|3[01]) *[ \-\|] *(0?\d|1\d|2[0-3]):([0-5]\d) *$/,
                parse: /^ *(\d{4})([-\/\. ?])(0?[1-9]|1[0-2])\2(0?[1-9]|[1-2]\d|3[01]) *[ \-\|] *(0?\d|1\d|2[0-3]):([0-5]\d) *$/,
                precision: 'day-minutes'
            },
            // dates with a time
            'MM/DD/YYYY HH:MM:SS': {
                test: /^ *(0?[1-9]|1[0-2])([-\/] ?)(0?[1-9]|[1-2]\d|3[01])\2([12]\d{3}) *[ \-\|] *(0?\d|1\d|2[0-3]):([0-5]\d)(?::([0-5]\d))? *$/,
                parse: /^ *(0?[1-9]|1[0-2])([-\/] ?)(0?[1-9]|[1-2]\d|3[01])\2(\d{4}) *[ \-\|] *(0?\d|1\d|2[0-3]):([0-5]\d)(?::([0-5]\d))? *$/,
                precision: 'day-seconds'
            },
            'DD.MM.YYYY HH:MM:SS': {
                test: /^ *(0?[1-9]|[1-2]\d|3[01])([-\.\/ ?])(0?[1-9]|1[0-2])\2([12]\d{3}) *[ \-\|] *(0?\d|1\d|2[0-3]):([0-5]\d)(?::([0-5]\d))? *$/,
                parse: /^ *(0?[1-9]|[1-2]\d|3[01])([-\.\/ ?])(0?[1-9]|1[0-2])\2(\d{4}) *[ \-\|] *(0?\d|1\d|2[0-3]):([0-5]\d)(?::([0-5]\d))? *$/,
                precision: 'day-seconds'
            },
            'YYYY-MM-DD HH:MM:SS': {
                test: /^ *([12]\d{3})([-\/\. ?])(0?[1-9]|1[0-2])\2(0?[1-9]|[1-2]\d|3[01]) *[ \-\|] *(0?\d|1\d|2[0-3]):([0-5]\d)(?::([0-5]\d))? *$/,
                parse: /^ *(\d{4})([-\/\. ?])(0?[1-9]|1[0-2])\2(0?[1-9]|[1-2]\d|3[01]) *[ \-\|] *(0?\d|1\d|2[0-3]):([0-5]\d)(?::([0-5]\d))? *$/,
                precision: 'day-seconds'
            }
        };

    function test(str, key) {
        var fmt = knownFormats[key];
        if (_.isRegExp(fmt.test)) {
            return fmt.test.test(str);
        } else {
            return fmt.test(str, key);
        }
    }

    function parse(str, key) {
        var fmt = knownFormats[key];
        if (_.isRegExp(fmt.parse)) {
            return str.match(fmt.parse);
        } else {
            return fmt.parse(str, key);
        }
    }

    sample = sample || [];

    _.each(knownFormats, function(format, key) {
        _.each(sample, function(n) {
            if (matches[key] === undefined) matches[key] = 0;
            if (test(n, key)) {
                matches[key] += 1;
                if (matches[key] > bestMatch[1]) {
                    bestMatch[0] = key;
                    bestMatch[1] = matches[key];
                }
            }
        });
    });
    format = bestMatch[0];

    function dateFromIsoWeek(year, week, day) {
        var d = new Date(Date.UTC(year, 0, 3));
        d.setUTCDate(3 - d.getUTCDay() + (week-1)*7 + parseInt(day,10));
        return d;
    }

    function dateToIsoWeek(date) {
        var d = date.getUTCDay(),
            t = new Date(date.valueOf());
        t.setDate(t.getDate() - ((d + 6) % 7) + 3);
        var iso_year = t.getUTCFullYear(),
            w = Math.floor( (t.getTime() - new Date(iso_year, 0, 1, -6)) / 864e5);
        return [ iso_year, 1+Math.floor(w/7), d > 0 ? d : 7 ];
    }

    // public interface
    var type = {
        parse: function(raw) {
            if (_.isDate(raw) || _.isUndefined(raw)) return raw;
            if (!format || !_.isString(raw)) {
                errors++;
                return raw;
            }

            var m = parse(raw, format);

            if (!m) {
                errors++;
                return raw;
            } else {
                // increment errors anyway if string doesn't match strict format
                if (!test(raw, format)) errors++;
            }
            switch (format) {
                case 'YYYY': return new Date(m[1], 0, 1);
                case 'YYYY-H': return new Date(m[1], (m[2]-1) * 6, 1);
                case 'H-YYYY': return new Date(m[2], (m[1]-1) * 6, 1);
                case 'YYYY-Q': return new Date(m[1], (m[2]-1) * 3, 1);
                case 'Q-YYYY': return new Date(m[2], (m[1]-1) * 3, 1);
                case 'YYYY-M': return new Date(m[1], (m[2]-1), 1);
                case 'M-YYYY': return new Date(m[2], (m[1]-1), 1);
                case 'YYYY-WW': return dateFromIsoWeek(m[1], m[2], 1);
                case 'YYYY-WW-d': return dateFromIsoWeek(m[1], m[2], m[3]);
                case 'YYYY-MM-DD': return new Date(m[1], (m[3]-1), m[4]);
                case 'DD/MM/YYYY': return new Date(m[4], (m[3]-1), m[1]);
                case 'MM/DD/YYYY': return new Date(m[4], (m[1]-1), m[3]);
                case 'YYYY-MM-DD HH:MM': return new Date(m[1], (m[3]-1), m[4], m[5] || 0, m[6] || 0, 0);
                case 'DD.MM.YYYY HH:MM': return new Date(m[4], (m[3]-1), m[1], m[5] || 0, m[6] || 0, 0);
                case 'MM/DD/YYYY HH:MM': return new Date(m[4], (m[1]-1), m[3], m[5] || 0, m[6] || 0, 0);
                case 'YYYY-MM-DD HH:MM:SS': return new Date(m[1], (m[3]-1), m[4], m[5] || 0, m[6] || 0, m[7] || 0);
                case 'DD.MM.YYYY HH:MM:SS': return new Date(m[4], (m[3]-1), m[1], m[5] || 0, m[6] || 0, m[7] || 0);
                case 'MM/DD/YYYY HH:MM:SS': return new Date(m[4], (m[1]-1), m[3], m[5] || 0, m[6] || 0, m[7] || 0);
            }
            errors++;
            return raw;
        },
        toNum: function(d) { return d.getTime(); },
        fromNum: function(i) { return new Date(i); },
        errors: function() { return errors; },
        name: function() { return 'date'; },

        format: function(fmt) {
            if (arguments.length) {
                format = fmt;
                return type;
            }
            return format;
        },

        precision: function() { return knownFormats[format].precision; },

        // returns a function for formatting dates
        formatter: function(config) {
            if (!format) return _.identity;
            var M_pattern = Globalize.culture().calendar.patterns.M.replace('MMMM','MMM');
            switch (knownFormats[format].precision) {
                case 'year': return function(d) { return !_.isDate(d) ? d : d.getFullYear(); };
                case 'half': return function(d) { return !_.isDate(d) ? d : d.getFullYear() + ' H'+(d.getMonth()/6 + 1); };
                case 'quarter': return function(d) { return !_.isDate(d) ? d : d.getFullYear() + ' Q'+(d.getMonth()/3 + 1); };
                case 'month': return function(d) { return !_.isDate(d) ? d : Globalize.format(d, 'MMM yy'); };
                case 'week': return function(d) { return !_.isDate(d) ? d : dateToIsoWeek(d).slice(0,2).join(' W'); };
                case 'day': return function(d, verbose) { return !_.isDate(d) ? d : Globalize.format(d, verbose ? 'D' : 'd'); };
                case 'day-minutes': return function(d) { return !_.isDate(d) ? d : Globalize.format(d, M_pattern).replace(' ', '&nbsp;')+' - '+ Globalize.format(d, 't').replace(' ', '&nbsp;'); };
                case 'day-seconds': return function(d) { return !_.isDate(d) ? d : Globalize.format(d, 'T').replace(' ', '&nbsp;'); };
            }
        },

        isValid: function(val) {
            return _.isDate(type.parse(val));
        },

        ambiguousFormats: function() {
            var candidates = [];
            _.each(matches, function(cnt, fmt) {
                if (cnt == bestMatch[1]) {
                    candidates.push([fmt, fmt]); // key, label
                }
            });
            return candidates;
        }
    };
    return type;
};

// namespace for dataset sources

// API for sources is
//
// dw.datasource.delimited(opts).dataset();
//
dw.datasource = {};
/*
* dataset source for delimited files (CSV, TSV, ...)
*/

/**
* Smart delimited data parser.
* - Handles CSV and other delimited data.
* Includes auto-guessing of delimiter character
* Parameters:
*   options
*     delimiter : ","
*/


dw.datasource.delimited = function(opts) {

    function loadAndParseCsv() {
        if (opts.url) {
            return $.ajax({
                url: opts.url,
                method: 'GET',
                dataType: "text" // NOTE (edouard): Without that jquery try to parse the content and return a Document
            }).then(function(raw) {
                return new DelimitedParser(opts).parse(raw);
            });
        } else if (opts.csv) {
            var dfd = $.Deferred(),
                parsed = dfd.then(function(raw) {
                return new DelimitedParser(opts).parse(raw);
            });
            dfd.resolve(opts.csv);
            return parsed;
        }
        throw 'you need to provide either an URL or CSV data.';
    }

    var delimited = {
        dataset: loadAndParseCsv
    };
    return delimited;
};


var DelimitedParser = function(opts) {

    opts = _.extend({
        delimiter: "auto",
        quoteChar: "\"",
        skipRows: 0,
        emptyValue: null,
        transpose: false,
        firstRowIsHeader: true
    }, opts);

    this.__delimiterPatterns = getDelimiterPatterns(opts.delimiter, opts.quoteChar);
    this.opts = opts;
};

function getDelimiterPatterns(delimiter, quoteChar) {
    return new RegExp(
    (
    // Delimiters.
    "(\\" + delimiter + "|\\r?\\n|\\r|^)" +
    // Quoted fields.
    "(?:" + quoteChar + "([^" + quoteChar + "]*(?:" + quoteChar + "\"[^" + quoteChar + "]*)*)" + quoteChar + "|" +
    // Standard fields.
    "([^" + quoteChar + "\\" + delimiter + "\\r\\n]*))"), "gi");
}

_.extend(DelimitedParser.prototype, {

    parse: function(data) {

        var me = this,
            opts = this.opts;

        me.__rawData = data;

        if (opts.delimiter == 'auto') {
            opts.delimiter = me.guessDelimiter(data, opts.skipRows);
            me.__delimiterPatterns = getDelimiterPatterns(opts.delimiter, opts.quoteChar);
        }
        var columns = [],
            closure = opts.delimiter != '|' ? '|' : '#',
            arrData;

        data = closure + data.replace(/\s+$/g, '') + closure;

        function parseCSV(delimiterPattern, strData, strDelimiter) {
            // implementation and regex borrowed from:
            // http://www.bennadel.com/blog/1504-Ask-Ben-Parsing-CSV-Strings-With-Javascript-Exec-Regular-Expression-Command.htm

            // Check to see if the delimiter is defined. If not,
            // then default to comma.
            strDelimiter = (strDelimiter || ",");

            // Create an array to hold our data. Give the array
            // a default empty first row.
            var arrData = [
                []
            ];

            // Create an array to hold our individual pattern
            // matching groups.
            var arrMatches = null,
                strMatchedValue;

            // Keep looping over the regular expression matches
            // until we can no longer find a match.
            while (arrMatches = delimiterPattern.exec(strData)) {
                // Get the delimiter that was found.
                var strMatchedDelimiter = arrMatches[1];

                // Check to see if the given delimiter has a length
                // (is not the start of string) and if it matches
                // field delimiter. If id does not, then we know
                // that this delimiter is a row delimiter.
                if (
                    strMatchedDelimiter.length && (strMatchedDelimiter != strDelimiter)) {

                    // Since we have reached a new row of data,
                    // add an empty row to our data array.
                    arrData.push([]);

                }


                // Now that we have our delimiter out of the way,
                // let's check to see which kind of value we
                // captured (quoted or unquoted).
                if (arrMatches[2]) {

                    // We found a quoted value. When we capture
                    // this value, unescape any double quotes.
                    strMatchedValue = arrMatches[2].replace(new RegExp("\"\"", "g"), "\"");

                } else {

                    // We found a non-quoted value.
                    strMatchedValue = arrMatches[3];

                }


                // Now that we have our value string, let's add
                // it to the data array.
                arrData[arrData.length - 1].push(strMatchedValue);
            }

            // remove closure
            if (arrData[0][0].substr(0, 1) == closure) {
                arrData[0][0] = arrData[0][0].substr(1);
            }
            var p = arrData.length - 1,
                q = arrData[p].length - 1,
                r = arrData[p][q].length - 1;
            if (arrData[p][q].substr(r) == closure) {
                arrData[p][q] = arrData[p][q].substr(0, r);
            }

            // Return the parsed data.
            return (arrData);
        } // end parseCSV

        function transpose(arrMatrix) {
            // borrowed from:
            // http://www.shamasis.net/2010/02/transpose-an-array-in-javascript-and-jquery/
            var a = arrMatrix,
                w = a.length ? a.length : 0,
                h = a[0] instanceof Array ? a[0].length : 0;
            if (h === 0 || w === 0) {
                return [];
            }
            var i, j, t = [];
            for (i = 0; i < h; i++) {
                t[i] = [];
                for (j = 0; j < w; j++) {
                    t[i][j] = a[j][i];
                }
            }
            return t;
        }

        function makeDataset(arrData) {
            var columns = [],
                columnNames = {},
                rowCount = arrData.length,
                columnCount = arrData[0].length,
                rowIndex = opts.skipRows;

            // compute series
            var srcColumns = [];
            if (opts.firstRowIsHeader) {
                srcColumns = arrData[rowIndex];
                rowIndex++;
            }

            // check that columns names are unique and not empty

            for (var c = 0; c < columnCount; c++) {
                var col = _.isString(srcColumns[c]) ? srcColumns[c].replace(/^\s+|\s+$/g, '') : '',
                    suffix = col !== '' ? '' : 1;
                col = col !== '' ? col : 'X.';
                while (columnNames[col + suffix] !== undefined) {
                    suffix = suffix === '' ? 1 : suffix + 1;
                }
                columns.push({
                    name: col + suffix,
                    data: []
                });
                columnNames[col + suffix] = true;
            }

            _.each(_.range(rowIndex, rowCount), function(row) {
                _.each(columns, function(c, i) {
                    c.data.push(arrData[row][i] !== '' ? arrData[row][i] : opts.emptyValue);
                });
            });

            columns = _.map(columns, function(c) { return dw.column(c.name, c.data); });
            return dw.dataset(columns);
        } // end makeDataset

        arrData = parseCSV(this.__delimiterPatterns, data, opts.delimiter);
        if (opts.transpose) {
            arrData = transpose(arrData);
        }
        return makeDataset(arrData);
    }, // end parse


    guessDelimiter: function(strData) {
        // find delimiter which occurs most often
        var maxMatchCount = 0,
            k = -1,
            me = this,
            delimiters = ['\t', ';', '|', ','];
        _.each(delimiters, function(delimiter, i) {
            var regex = getDelimiterPatterns(delimiter, me.quoteChar),
                c = strData.match(regex).length;
            if (c > maxMatchCount) {
                maxMatchCount = c;
                k = i;
            }
        });
        return delimiters[k];
    }

}); // end _.extend(DelimitedParser)



dw.utils = {

    /*
     * returns the min/max range of a set of columns
     */
    minMax: function (columns) {
        var minmax = [Number.MAX_VALUE, -Number.MAX_VALUE];
            _.each(columns, function(column) {
                minmax[0] = Math.min(minmax[0], column.range()[0]);
                minmax[1] = Math.max(minmax[1], column.range()[1]);
            });
        return minmax;
    },

    /*
     * return a custom date tick format function for d3.time.scales
     *
     * @param daysDelta    the number of days between minimum and maximum date
     */
    dateFormat: function(daysDelta) {
        var new_month = true, last_date = false;
        function timeFormat(formats) {
            return function(date) {
                new_month = !last_date || date.getMonth() != last_date.getMonth();
                last_date = date;
                var i = formats.length - 1, f = formats[i];
                while (!f[1](date)) f = formats[--i];
                return f[0](date);
            };
        }

        function time_fmt(fmt) {
            var format = function(date) {
                var r = Globalize.format(date, fmt);
                return fmt != 'htt' ? r : r.toLowerCase();
            };
            return format;
        }

        var fmt = (function(lang) {
            return {
                date: lang == 'de' ? "dd." : "dd",
                hour: lang != 'en' ? "H:00" : "htt",
                minute: lang == 'de' ? "H:mm" : 'h:mm',
                mm: lang == 'de' ? 'd.M.' : 'MM/dd',
                mmm: lang == 'de' ? 'd.MMM' : 'MMM dd',
                mmmm: lang == 'de' ? 'd. MMMM' : 'MMMM dd'
            };
        })(Globalize.culture().language);

        // use globalize instead of d3
        return timeFormat([
            [time_fmt("yyyy"),
                function() { return true; }],
            [time_fmt(daysDelta > 70 ? "MMM" : "MMM"),
                function(d) { return d.getMonth() !== 0; }],  // not January
            [time_fmt(fmt.date),
                function(d) { return d.getDate() != 1; }],  // not 1st of month
            [time_fmt(daysDelta < 7 ? fmt.mm : daysDelta > 70 ? fmt.mmm : fmt.mmm),
                function(d) { return d.getDate() != 1 && new_month; }],  // not 1st of month
            //[time_fmt("%a %d"), function(d) { return d.getDay() && d.getDate() != 1; }],  // not monday
            [time_fmt(fmt.hour),
                function(d) { return d.getHours(); }],
            [time_fmt(fmt.minute),
                function(d) { return d.getMinutes(); }],
            [time_fmt(":ss"),
                function(d) { return d.getSeconds(); }],
            [time_fmt(".fff"),
                function(d) { return d.getMilliseconds(); }]
        ]);
    },

    /**
     * DEPRECATED
     * returns a function for formating a date based on the
     * input format of the dates in the dataset
     */
    longDateFormat: function(column) {
        var me = this;
        return function(d) {
            if (column.type() == 'date') {
                switch (column.type(true).precision()) {
                    case 'year': return d.getFullYear();
                    case 'quarter': return d.getFullYear() + ' Q'+(d.getMonth()/3 + 1);
                    case 'month': return Globalize.format(d, 'MMM yy');
                    case 'day': return Globalize.format(d, 'MMM d');
                    case 'minute': return Globalize.format(d, 't');
                    case 'second': return Globalize.format(d, 'T');
                }
            } else {
                return d;
            }
        };
    },

    columnNameColumn: function(columns) {
        var names = _.map(columns, function(col) { return col.title(); });
        return dw.column('', names);
    },

    name: function(obj) {
        return _.isFunction(obj.name) ? obj.name() : _.isString(obj.name) ? obj.name : obj;
    },

    getMaxChartHeight: function(el) {
        function margin(el, type) {
            if ($(el).css('margin-' + type) == 'auto') return 0;
            return +$(el).css('margin-' + type).replace('px', '');
        }
        var ch = 0, bottom = 0; // summed height of children, 10px for top & bottom margin
        $('body > *').each(function(i, el) {
            var t = el.tagName.toLowerCase();
            if (t != 'script' && el.id != 'chart' && !$(el).hasClass('tooltip') &&
                !$(el).hasClass('qtip') && !$(el).hasClass('container') &&
                !$(el).hasClass('noscript')) {
                ch += $(el).outerHeight(false); // element height
            }
            ch += Math.max(margin(el, 'top'), bottom);
            bottom = margin(el, 'bottom');
        });
        ch += bottom;
        // subtract body padding
        //ch += $('body').innerHeight() - $('body').height();
        var mt = $('#chart').css('margin-top').replace('px', ''),
            mb = $('#chart').css('margin-bottom').replace('px', ''),
            // FIXME: -8 instead of -2 because when `introduction` is filled, a scrollbar appears.
            // Should be dynamic.
            maxH = $(window).height() - ch - 8;
        // IE Fix
        if (!$.support.leadingWhitespace) maxH -= 15;
        maxH -= $('body').css('padding-top').replace('px', '');
        maxH -= $('body').css('padding-bottom').replace('px', '');
        return maxH;
    },

    /*
     * Remove all html tags from the given string
     *
     * written by Kevin van Zonneveld et.al.
     * taken from https://github.com/kvz/phpjs/blob/master/functions/strings/strip_tags.js
     */
    purifyHtml: function(input, allowed) {
        var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
            commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi,
            default_allowed = "<b><br><br/><i><strong><sup><sub><strike><u><em><tt>",
            allowed_split = {};

        if (allowed === undefined) allowed = default_allowed;
        allowed_split[allowed] = (((allowed || "") + "").toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join(''); // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)

        function purifyHtml(input, allowed) {
            if (!_.isString(input) || input.indexOf("<") < 0) {
                return input;
            }
            if (allowed === undefined) {
                allowed = default_allowed;
            }
            if (!allowed_split[allowed]) {
                allowed_split[allowed] = (((allowed || "") + "").toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join(''); // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
            }
            return input.replace(commentsAndPhpTags, '').replace(tags, function ($0, $1) {
                return allowed_split[allowed].indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : '';
            });
        }
        dw.utils.purifyHtml = purifyHtml;
        return purifyHtml(input, allowed);
    },

    /*
     *
     */
    significantDimension: function(values) {
        var result = [], dimension = 0, nonEqual = true,
            uniqValues = _.uniq(values),
            check, diff;

        if (uniqValues.length == 1) {
            return -1 * Math.floor(Math.log(uniqValues[0])/Math.LN10);
        }

        if (_.uniq(_.map(uniqValues, round)).length == uniqValues.length) {
            check = function() { return _.uniq(result).length == uniqValues.length; };
            diff = -1;
        } else {
            check = function() { return _.uniq(result).length < uniqValues.length; };
            diff = +1;
        }
        var max_iter = 100;
        do {
            result = _.map(uniqValues, round);
            dimension += diff;
        } while (check() && max_iter-- > 0);
        if (max_iter < 10) {
            console.warn('maximum iteration reached', values, result, dimension);
        }
        if (diff < 0) dimension += 2; else dimension--;
        function round(v) {
            return dw.utils.round(v, dimension);
        }
        return dimension;
    },

    round: function(value, dimension) {
        var base = Math.pow(10, dimension);
        return Math.round(value * base) / base;
    },

    /*
     * Rounds a set of unique numbers to the lowest
     * precision where the values remain unique
     */
    smartRound: function(values, add_precision) {
        var dim = dw.utils.significantDimension(values);
        dim += add_precision || 0;
        return _.map(values, function(v) { return dw.utils.round(v, dim); });
    },

    /*
     * returns the number in array that is closest
     * to the given value
     */
    nearest: function(array, value) {
        var min_diff = Number.MAX_VALUE, min_diff_val;
        _.each(array, function(v) {
            var d = Math.abs(v - value);
            if (d < min_diff) {
                min_diff = d;
                min_diff_val = v;
            }
        });
        return min_diff_val;
    },

    metricSuffix: function(locale) {
        switch (locale.substr(0, 2).toLowerCase()) {
            case 'de': return { 3: ' Tsd.', 6: ' Mio.', 9: ' Mrd.', 12: ' Bio.' };
            case 'fr': return { 3: ' mil', 6: ' Mio', 9: ' Mrd' };
            case 'es': return { 3: ' Mil', 6: ' millón' };
            default: return { 3: 'k', 6: 'M', 9: ' bil' };
        }
    },

    magnitudeRange: function(minmax) {
        var e0 = Math.round(Math.log(minmax[0]) / Math.LN10),
            e1 = Math.round(Math.log(minmax[1]) / Math.LN10);
        return e1 - e0;
    },

    logTicks: function(min, max) {
        var e0 = Math.round(Math.log(min) / Math.LN10),
            e1 = Math.round(Math.log(max) / Math.LN10);
        return _.map(_.range(e0, e1), function(exp) { return Math.pow(10, exp); });
    }

};

/**
 * @param column  the values that can be selected
 * @paran type    type of filter ui: buttons|select|timescale
 * @param format  a function for formatting the values
 */
dw.utils.filter = function (column, active, type, format) {
    var callbacks = [],
        lastActiveRow;

    type = type || 'auto';
    format = format || _.identity;

    if (type == 'auto') {
        if (column.type() == 'date') type = 'timescale';
        else if (column.type() == 'text') type = column.length < 6 ? 'buttons' : 'select';
    }

    var filter = {
        ui: getFilterUI(type),
        change: function(callback) {
            callbacks.push(callback);
        }
    };

    function update(i) {
        _.each(callbacks, function(cb) {
            if (_.isFunction(cb)) {
                cb(column.val(i), i);
            }
        });
    }


    function getFilterUI(type) {
        var f;

        if (type == 'auto') {
            type = column.type() == 'date' ? 'timescale' :
                column.length < 6 ? 'buttons' : 'select';
        }

        if (column.length < 2) return function() { return false; };

        if (type == 'select') f = function(vis) {
            // use <select>
            var select = $('<select />');
            column.each(function(val, i) {
                var lbl = format(val);
                if (!lbl) return;
                select.append('<option value="'+i+'">'+(_.isString(lbl) ? $.trim(lbl) : lbl)+'</option>');
            });
            select.change(function(evt) {
                var cur = select.val();
                update(cur);
            });
            select.addClass('filter-ui filter-select');
            return select;
        };

        if (type == 'buttons') f = function(vis) {
            // use link buttons
            var div = $('<div />');
            div.addClass('filter-ui filter-links');
            column.each(function(val, i) {
                var lbl = format(val);
                if (!lbl) return;
                var a = $('<a href="#'+i+'"'+(i == active ? ' class="active" ': '')+'>'+(_.isString(lbl) ? $.trim(lbl) : lbl)+'</a>').data('row', i);
                div.append(a);
            });
            $('a', div).click(function(e) {
                var a = $(e.target);
                e.preventDefault();
                if (a.hasClass('active')) return;
                $('a', div).removeClass('active');
                a.addClass('active');
                update(a.data('row'));
            });
            div.appendTo('body');
            var fy = $('a:first', div).offset().top,
                ly = $('a:last', div).offset().top;
            if (fy != ly) {
                div.remove();
                return getFilterUI('select')(vis); // fall back to select
            }
            return div;
        };

        if (type == 'timescale') f = function(vis) {
            var w = Math.min(vis.__w-30, Math.max(300, vis.__w * 0.7)),
                timescale = d3.time.scale()
                    .domain([column.val(0), column.val(-1)])
                    .range([0, w]),
                timesel = $('<div></div>').css({
                    position:'relative',
                    height: 45,
                    'margin-left': 3
                }).addClass('filter-ui'),
                nticks = w / 80,
                ticks = timescale.ticks(nticks),
                daysDelta = Math.round((column.val(-1).getTime() - column.val(0).getTime()) / 86400000),
                fmt = dw.utils.dateFormat(daysDelta),
                lfmt = column.type(true).formatter(),
                dots = timescale.ticks(w / 8),
                lbl_x = function(i) { return Math.max(-18, timescale(column.val(i)) - 40); };

            // show text labels for bigger tick marks (about every 80 pixel)
            _.each(ticks, function(d) {
                var s = $('<span>'+fmt(d)+'</span>'),
                    x = timescale(d) - 40,
                    lw = vis.labelWidth(fmt(d));
                if (40 - lw*0.5 + x < 0) x = -40 +0.5 * lw;
                s.css({ position: 'absolute', top:0, width: 80, left: x,
                    'text-align': 'center', opacity: 0.55 });
                timesel.append(s);
            });

            // show tiny tick marks every 15 pixel
            _.each(dots, function(d) {
                if (d.getTime() < column.val(0).getTime() || d.getTime() > column.val(-1).getTime()) return;
                var s = $('<span class="dot"></span>');
                s.css({
                    position: 'absolute',
                    bottom: 19,
                    width: 1,
                    height: '1ex',
                    'border-left': '1px solid #000',
                    'vertical-align': 'bottom',
                    left: Math.round(timescale(d))+0.5
                });
                if (!_.find(ticks, function(td) { return d.getTime() == td.getTime(); })) {
                    s.css({ height: '0.6ex', opacity: 0.5 });
                }
                timesel.append(s);
            });

            // a pointer symbol to highlight the current date
            var pointer = $('<div>▲</div>').css({
                position: 'absolute',
                width: 20,
                bottom: 2,
                left: timescale(column.val(active))-9,
                'text-align': 'center'});
            timesel.append(pointer);

            // a label to show the current date
            var lbl = $('<div><span></span></div>').css({
                position: 'absolute',
                width: 80,
                top: 0,
                left: lbl_x(active),
                'text-align': 'center'
            })
             .data('last-txt', lfmt(column.val(active)))
             .data('last-left', lbl_x(active));

            $('span', lbl).css({
                background: vis.theme().colors.background,
                'font-weight': 'bold',
                'padding': '0 1ex'
            }).html(lfmt(column.val(active)));
            timesel.append(lbl);

            // add hairline as time axis
            $('<div />').css({
                position: 'absolute',
                width: w+1,
                bottom: 15,
                height: 2,
                'border-bottom': '1px solid #000'
            }).appendTo(timesel);

            // add an invisible div to catch mouse events
            var bar = $('<div />').css({
                position: 'absolute',
                left: 0,
                width: w,
                height: 40
            });
            timesel.append(bar);

            /*
             * this helper function returns the nearest date to an x position
             */
            function nearest(rel_x) {
                var x_date = timescale.invert(rel_x),
                    min_dist = Number.MAX_VALUE,
                    nearest_row = 0;
                // find nearest date
                column.each(function(date, i) {
                    var dist = Math.abs(date.getTime() - x_date.getTime());
                    if (dist < min_dist) {
                        min_dist = dist;
                        nearest_row = i;
                    }
                });
                return nearest_row;
            }

            var autoClickTimer;

            // clicking the bar updates the visualization
            bar.click(function(evt) {
                // find nearest data row
                var rel_x = evt.clientX - bar.offset().left,
                    nearest_row = nearest(rel_x);
                update(nearest_row);
                timesel.data('update-func')(nearest_row);
                clearTimeout(autoClickTimer);
            });

            // hovering the bar shows nearest date
            bar.mousemove(function(evt) {
                var rel_x = evt.clientX - bar.offset().left,
                    nearest_row = nearest(rel_x);
                $('span', lbl).html(lfmt(column.val(nearest_row)));
                lbl.css({ left: lbl_x(nearest_row) });
                pointer.css({ left: timescale(column.val(nearest_row)) - 10 });
                clearTimeout(autoClickTimer);
                autoClickTimer = setTimeout(function() {
                    update(nearest_row);
                    lbl.data('last-left', lbl_x(nearest_row));
                    lbl.data('last-txt', lbl.text());
                }, 500);
            });

            // reset position after mouse has gone
            bar.mouseleave(function() {
                lbl.css({ left: lbl.data('last-left') });
                pointer.css({ left: lbl.data('last-left')+30 });
                $('span', lbl).html(lbl.data('last-txt'));
                clearTimeout(autoClickTimer);
            });

            timesel.data('update-func', function(i) {
                pointer.stop().animate({ left: timescale(column.val(i)) - 10 }, 500, 'expoInOut');

                var l_x = lbl_x(i),
                    lbl_txt = lfmt(column.val(i));

                $('span', lbl).html(lbl_txt);
                lbl.css({ left: l_x });
                lbl.data('last-left', l_x);
                lbl.data('last-txt', lbl_txt);
            });
            return timesel;
        };

        return f;
    }

    return filter;
};

/*
 *
 */

dw.chart = function(attributes) {

    // private methods and properties
    var dataset,
        theme,
        visualization,
        metric_prefix,
        change_callbacks = $.Callbacks(),
        locale;

    // public interface
    var chart = {
        // returns an attribute
        get: function(key, _default) {
            var keys = key.split('.'),
                pt = attributes;

            _.some(keys, function(key) {
                if (_.isUndefined(pt) || _.isNull(pt)) return true; // break out of the loop
                pt = pt[key];
                return false;
            });
            return _.isUndefined(pt) || _.isNull(pt) ? _default : pt;
        },

        set: function(key, value) {
            var keys = key.split('.'),
                lastKey = keys.pop(),
                pt = attributes;

            // resolve property until the parent dict
            _.each(keys, function(key) {
                if (_.isUndefined(pt[key]) || _.isNull(pt[key])) {
                    pt[key] = {};
                }
                pt = pt[key];
            });

            // check if new value is set
            if (!_.isEqual(pt[lastKey], value)) {
                pt[lastKey] = value;
                change_callbacks.fire(chart, key, value);
            }
            return this;
        },

        // loads the dataset and returns a deferred
        load: function() {
            var datasource;

            datasource = dw.datasource.delimited({
                url: 'data.csv',
                firstRowIsHeader: chart.get('metadata.data.horizontal-header', true),
                transpose: chart.get('metadata.data.transpose', false)
            });

            return datasource.dataset().pipe(function(ds) {
                chart.dataset(ds);
                return ds;
            });
        },

        // returns the dataset
        dataset: function(ds) {
            if (arguments.length) {
                dataset = applyChanges(ds);
                return chart;
            }
            return dataset;
        },

        // sets or gets the theme
        theme: function(_theme) {
            if (arguments.length) {
                theme = _theme;
                return chart;
            }
            return theme || {};
        },

        // sets or gets the visualization
        vis: function(_vis) {
            if (arguments.length) {
                visualization = _vis;
                visualization.chart(chart);
                return chart;
            }
            return visualization;
        },

        // returns true if the user has set any highlights
        hasHighlight: function() {
            var hl = chart.get('metadata.visualize.highlighted-series');
            return _.isArray(hl) && hl.length > 0;
        },

        isHighlighted: function(obj) {
            if (_.isUndefined(obj) === undefined) return false;
            var hl = this.get('metadata.visualize.highlighted-series'),
                obj_name = dw.utils.name(obj);
            return !_.isArray(hl) || hl.length === 0 || _.indexOf(hl, obj_name) >= 0;
        },

        locale: function(_locale) {
            if (arguments.length) {
                locale = _locale;
                Globalize.culture(locale);
                return chart;
            }
            return locale;
        },

        metricPrefix: function(_metric_prefix) {
            if (arguments.length) {
                metric_prefix = _metric_prefix;
                return chart;
            }
            return metric_prefix;
        },

        formatValue: function(val, full, round) {
            var format = chart.get('metadata.describe.number-format'),
                div = Number(chart.get('metadata.describe.number-divisor')),
                append = chart.get('metadata.describe.number-append', '').replace(' ', '&nbsp;'),
                prepend = chart.get('metadata.describe.number-prepend', '').replace(' ', '&nbsp;');

            if (div !== 0) val = Number(val) / Math.pow(10, div);
            if (format != '-') {
                if (round || val == Math.round(val)) format = format.substr(0,1)+'0';
                val = Globalize.format(val, format);
            } else if (div !== 0) {
                val = val.toFixed(1);
            }
            return full ? prepend + val + append : val;
        },

        render: function(container) {
            if (!visualization || !theme || !dataset) {
                throw 'cannot render the chart!';
            }
            visualization.chart(chart);
            visualization.__init();
            var $cont = $(container);
            $cont
                .parent()
                .addClass('vis-'+visualization.id)
                .addClass('theme-'+theme.id);
            visualization.render($cont);
        },

        attributes: function(attrs) {
            if (arguments.length) {
                attributes = attrs;
                return chart;
            }
            return attributes;
        },

        onChange: change_callbacks.add,

        columnFormatter: function(column) {
            // pull output config from metadata
            // return column.formatter(config);
            var colFormat = chart.get('metadata.data.column-format', {});
            colFormat = colFormat[column.name()] || {};

            if (column.type() == 'number' && colFormat == 'auto') {
                var mtrSuf = dw.utils.metricSuffix(chart.locale()),
                    values = column.values(),
                    dim = dw.utils.significantDimension(values),
                    div = dim < -2 ? Math.round((dim*-1) / 3) * 3 :
                            dim > 2 ? dim*-1 : 0;
                    ndim = dw.utils.significantDimension(_.map(values, function(v) {
                        return v / Math.pow(10, div);
                    }));

                colFormat = {
                    'number-divisor': div,
                    'number-append': div ? mtrSuf[div] || ' × 10<sup>'+div+'</sup>' : '',
                    'number-format': 'n'+Math.max(0, ndim)
                };
            }
            return column.type(true).formatter(colFormat);
        }

    };

    function applyChanges(dataset) {
        var changes = chart.get('metadata.data.changes', []);
        var transpose = chart.get('metadata.data.transpose', false);
        _.each(changes, function(change) {
            var row = "row", column = "column";
            if (transpose) {
                row = "column";
                column = "row";
            }

            if (dataset.hasColumn(change[column])) {
                if (change[row] === 0) {
                    dataset.column(change[column]).title(change.value);
                }
                else {
                    dataset.column(change[column]).raw(change[row] - 1, change.value);
                }
            }
        });

        var columnFormats = chart.get('metadata.data.column-format', {});
        _.each(columnFormats, function(columnFormat, key) {
            if (columnFormat.type && dataset.hasColumn(key)) {
                dataset.column(key).type(columnFormat.type);
            }
            if (columnFormat['input-format'] && dataset.hasColumn(key)) {
                dataset.column(key).type(true).format(columnFormat['input-format']);
            }
        });
        return dataset;
    }

    return chart;
};

dw.visualization = (function(){

    var __vis = {};

    var visualization = function(id) {
        return new __vis[id]();
    };

    visualization.register = function(id) {
        var parent = arguments.length == 3 ? __vis[arguments[1]].prototype : dw.visualization.base,
            props = arguments[arguments.length - 1],
            vis = __vis[id] = function() {};

        _.extend(vis.prototype, parent, { id: id }, props);
    };

    return visualization;

})();


// Every visualization must extend this class.
// It provides the basic API between the chart template
// page and the visualization class.

dw.visualization.base = (function() {}).prototype;

_.extend(dw.visualization.base, {

    // called before rendering
    __init: function() {
        this.__renderedDfd = $.Deferred();
        if (window.parent && window.parent['postMessage']) {
            window.parent.postMessage('datawrapper:vis:init', '*');
        }
        return this;
    },

    render: function(el) {
        $(el).html('implement me!');
    },

    theme: function(theme) {
        if (!arguments.length) return this.__theme;
        this.__theme = theme;
        var attr_properties = ['horizontalGrid', 'verticalGrid', 'yAxis', 'xAxis'];
        _.each(attr_properties, function(prop) {
            // convert camel-case to dashes
            if (theme.hasOwnProperty(prop)) {
                for (var key in theme[prop]) {
                    // dasherize
                    var lkey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
                    if (!theme[prop].hasOwnProperty(lkey)) {
                        theme[prop][lkey] = theme[prop][key];
                    }
                }
            }
        });
        return this;
    },

    size: function(width, height) {
        var me = this;
        if (!arguments.length) return [me.__w, me.__h];
        me.__w = width;
        me.__h = height;
        return me;
    },

    /**
     * short-cut for this.chart.get('metadata.visualize.*')
     */
    get: function(str, _default) {
        return this.chart().get('metadata.visualize.'+str, _default);
    },

    notify: function(str) {
        if (dw.backend && _.isFunction(dw.backend.notify)) {
            return dw.backend.notify(str);
        } else {
            if (window.parent && window.parent['postMessage']) {
                window.parent.postMessage('notify:'+str, '*');
            } else if (window['console']) {
                console.log(str);
            }
        }
    },

    /**
     * returns a signature for this visualization which will be used
     * to test correct rendering of the chart in different browsers.
     * See raphael-chart.js for example implementation.
     */
    signature: function() {
        // nothing here, please overload
    },

    translate: function(str) {
        var locale = this.meta.locale, lang = this.lang;
        return locale[str] ? locale[str][lang] || locale[str] : str;
    },

    checkBrowserCompatibility: function(){
        return true;
    },

    chart: function(chart) {
        var me = this;
        if (!arguments.length) return me.__chart;
        me.dataset = chart.dataset();
        me.theme(chart.theme());
        me.__chart = chart;
        var columnFormat = chart.get('metadata.data.column-format', {});
        var ignore = {};
        _.each(columnFormat, function(format, key) {
            ignore[key] = !!format.ignore;
        });
        me.dataset.filterColumns(ignore);
        return me;
    },

    axes: function(returnAsColumns) {
        var me = this,
            dataset = me.dataset,
            usedColumns = {},
            axes = {},
            axesDef,
            axesAsColumns = {},
            errors = [];

        // get user preference
        axesDef = me.chart().get('metadata.axes', {});
        _.each(me.meta.axes, function(o, key) {
            if (axesDef[key]) {
                var columns = axesDef[key];
                if (columnExists(columns)) {
                    axes[key] = columns;
                    // mark columns as used
                    if (!_.isArray(columns)) columns = [columns];
                    _.each(columns, function(column) {
                        usedColumns[column] = true;
                    });
                }
            }
        });

        // auto-populate remaining axes
        _.each(me.meta.axes, function(axisDef, key) {
            function checkColumn(col) {
                return !usedColumns[col.name()] &&
                    _.indexOf(axisDef.accepts, col.type()) >= 0;
            }
            function errMissingColumn() {
                var msg = dw.backend ?
                        dw.backend.messages.insufficientData :
                        'The visualization needs at least one column of the type %type to populate axis %key';
                errors.push(msg.replace('%type', axisDef.accepts).replace('%key', key));
            }
            if (axes[key]) return;  // user has defined this axis already
            if (!axisDef.optional) {
                if (!axisDef.multiple) {
                    // find first colulmn accepted by axis
                    var c = _.find(dataset.columns(), checkColumn);
                    if (c) {
                        usedColumns[c.name()] = true; // mark column as used
                        axes[key] = c.name();
                    } else {
                        // try to auto-populate missing text column
                        if (_.indexOf(axisDef.accepts, 'text') >= 0) {
                            var col = dw.column(key, _.map(_.range(dataset.numRows()), function(i) {
                                return (i > 25 ? String.fromCharCode(64+i/26) : '') + String.fromCharCode(65+(i%26));
                            }), 'text');
                            dataset.add(col);
                            me.chart().dataset(dataset);
                            usedColumns[col.name()] = true;
                            axes[key] = col.name();
                        } else {
                            errMissingColumn();
                        }
                    }
                } else {
                    axes[key] = [];
                    dataset.eachColumn(function(c) {
                        if (checkColumn(c)) {
                            usedColumns[c.name()] = true;
                            axes[key].push(c.name());
                        }
                    });
                    if (!axes[key].length) {
                        errMissingColumn();
                    }
                }
            } else {
                axes[key] = false;
            }
        });

        if (errors.length) {
            me.notify(errors.join('<br />'));
        }

        _.each(axes, function(columns, key) {
            if (!_.isArray(columns)) {
                axesAsColumns[key] = columns !== false ? me.dataset.column(columns) : null;
            } else {
                axesAsColumns[key] = [];
                _.each(columns, function(column, i) {
                    axesAsColumns[key][i] = column !== false ? me.dataset.column(column) : null;
                });
            }
        });

        me.axes = function(returnAsColumns) {
            return returnAsColumns ? axesAsColumns : axes;
        };

        function columnExists(columns) {
            if (!_.isArray(columns)) columns = [columns];
            for (var i=0; i<columns.length; i++) {
                if (!dataset.hasColumn(columns[i])) return false;
            }
            return true;
        }

        return me.axes(returnAsColumns);
    },

    keys: function() {
        var me = this,
            axesDef = me.axes();
        if (axesDef.labels) {
            var lblCol = me.dataset.column(axesDef.labels),
                fmt = me.chart().columnFormatter(lblCol),
                keys = [];
            lblCol.each(function(val) {
                keys.push(String(fmt(val)));
            });
            return keys;
        }
        return [];
    },

    keyLabel: function(key) {
        return key;
    },

    /*
     * called by the core whenever the chart is re-drawn
     * without reloading the page
     */
    reset: function() {
        this.clear();
        $('#chart').html('').off('click').off('mousemove').off('mouseenter').off('mouseover');
        $('.chart .filter-ui').remove();
        $('.chart .legend').remove();
    },

    clear: function() {

    },

    renderingComplete: function() {
        if (window.parent && window.parent['postMessage']) {
            window.parent.postMessage('datawrapper:vis:rendered', '*');
        }
        this.__renderedDfd.resolve();
    },

    rendered: function() {
        return this.__renderedDfd.promise();
    },

    /*
     * smart rendering means that a visualization is able to
     * re-render itself without having to instantiate it again
     */
    supportsSmartRendering: function() {
        return false;
    },

    /*
     * this hook is used for optimizing the thumbnails on Datawrapper
     * the function is expected to return the svg element that contains
     * the elements to be rendered in the thumbnails
     */
    _svgCanvas: function() {
        return false;
    }

});



dw.theme = (function(){

    var __themes = {};

    var theme = function(id) {
        return __themes[id];
    };

    theme.register = function(id) {
        var parent = arguments.length == 3 ? __themes[arguments[1]] : dw.theme.base,
            props = arguments[arguments.length - 1];

        __themes[id] = extend({}, parent, { id: id }, props);
    };

    /*
     * taken from jQuery 1.10.2 $.extend, but changed a little
     * so that arrays are not deep-copied. also deep-coping
     * cannot be turned off anymore.
     */
    function extend() {
        var options, name, src, copy, copyIsArray, clone,
            target = arguments[0] || {},
            i = 1,
            length = arguments.length;

        // Handle case when target is a string or something (possible in deep copy)
        if ( typeof target !== "object" && !_.isFunction(target) ) {
            target = {};
        }

        for ( ; i < length; i++ ) {
            // Only deal with non-null/undefined values
            if ( (options = arguments[ i ]) != null ) {
                // Extend the base object
                for ( name in options ) {
                    src = target[ name ];
                    copy = options[ name ];

                    // Prevent never-ending loop
                    if ( target === copy ) {
                        continue;
                    }

                    // Recurse if we're merging plain objects or arrays
                    if ( copy && isPlainObject(copy) ) {
                        clone = src && isPlainObject(src) ? src : {};

                        // Never move original objects, clone them
                        target[ name ] = extend( clone, copy );
                    // Don't bring in undefined values
                    } else if ( copy !== undefined ) {
                        target[ name ] = copy;
                    }
                }
            }
        }
        // Return the modified object
        return target;
    }

    function isPlainObject(o) {
        return _.isObject(o) && !_.isArray(o) && !_.isFunction(o);
    }

    return theme;

})();


// Every theme must extend this class.
// It provides the basic API between the chart template
// page and the visualization class.

dw.theme.base = {

    /*
     * colors used in the theme
     */
    colors: {
        palette: ['#6E7DA1', '#64A4C4', '#53CCDD',  '#4EF4E8'],
        secondary: ["#000000", '#777777', '#cccccc', '#ffd500', '#6FAA12'],

        positive: '#85B4D4',
        negative: '#E31A1C',
        // colors background and text needs to be set in CSS as well!
        background: '#ffffff',
        text: '#000000',

        /*
         * gradients that might be used by color gradient selectors
         *
         * Colors from www.ColorBrewer2.org by Cynthia A. Brewer,
         * Geography, Pennsylvania State University.
         */
        gradients: [
            ['#fefaca', '#008b15'], // simple yellow to green
            ['#f0f9e8','#ccebc5','#a8ddb5','#7bccc4','#43a2ca','#0868ac'],  // GnBu
            ['#feebe2','#fcc5c0','#fa9fb5','#f768a1','#c51b8a','#7a0177'],  // RdPu
            ['#ffffcc','#c7e9b4','#7fcdbb','#41b6c4','#2c7fb8','#253494'],  // YlGnbu

            ['#8c510a','#d8b365','#f6e8c3','#f5f7ea','#c7eae5','#5ab4ac','#01665e'],  // BrBG
            ['#c51b7d','#e9a3c9','#fde0ef','#faf6ea','#e6f5d0','#a1d76a','#4d9221'],  // PiYG
            ['#b2182b','#ef8a62','#fddbc7','#f8f6e9','#d1e5f0','#67a9cf','#2166ac'],  // RdBu
            //['#b35806','#f1a340','#fee0b6','#f7f7f7','#d8daeb','#998ec3','#542788'],  // PuOr
        ],

        /*
         * presets for category colors
         *
         * Colors from www.ColorBrewer2.org by Cynthia A. Brewer,
         * Geography, Pennsylvania State University.
         */
        categories: [
            ["#7fc97f", "#beaed4", "#fdc086", "#ffff99", "#386cb0", "#f0027f", "#bf5b17", "#666666"], // Accent
            ["#fbb4ae", "#b3cde3", "#ccebc5", "#decbe4", "#fed9a6", "#ffffcc", "#e5d8bd", "#fddaec", "#f2f2f2"], // Pastel1
            ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c", "#fdbf6f", "#ff7f00", "#cab2d6", "#6a3d9a", "#ffff99", "#b15928"] // Paired
        ]
    },

    /*
     * padding around the chart area
     */
    padding: {
        left: 0,
        right: 20,
        bottom: 30,
        top: 10
    },

    /*
     * custom properties for line charts
     */
    lineChart: {
        // stroke width used for lines, in px
        strokeWidth: 3,
        // the maximum width of direct labels, in px
        maxLabelWidth: 80,
        // the opacity used for fills between two lines
        fillOpacity: 0.2,
        // distance between labels and x-axis
        xLabelOffset: 20
    },

    /*
     * custom properties for column charts
     */
    columnChart: {
        // if set to true, the horizontal grid lines are cut
        // so that they don't overlap with the grid label.
        cutGridLines: false,
        // you can customize bar attributes
        barAttrs: {
            'stroke-width': 1
        },
        // make strokes a little darker than the fill
        darkenStroke: 18
    },

    /*
     * custom properties for bar charts
     */
    barChart: {
        // you can customize bar attributes
        barAttrs: {
            'stroke-width': 1
        }
    },

    /*
     * attributes of x axis, if there is any
     */
    xAxis: {
        stroke: '#333'
    },

    /*
     * attributes of y-axis if there is any shown
     */
    yAxis: {
        strokeWidth: 1
    },


    /*
     * attributes applied to horizontal grids if displayed
     * e.g. in line charts, column charts, ...
     *
     * you can use any property that makes sense on lines
     * such as stroke, strokeWidth, strokeDasharray,
     * strokeOpacity, etc.
     */
    horizontalGrid: {
        stroke: '#d9d9d9'
    },

    /*
     * just like horizontalGrid. used in line charts only so far
     *
     * you can define the grid line attributes here, e.g.
     * verticalGrid: { stroke: 'black', strokeOpacity: 0.4 }
     */
    verticalGrid: false,

    /*
     * draw a frame around the chart area (only in line chart)
     *
     * you can define the frame attributes here, e.g.
     * frame: { fill: 'white', stroke: 'black' }
     */
    frame: false,

    /*
     * if set to true, the frame border is drawn separately above
     * the other chart elements
     */
    frameStrokeOnTop: false,

    /*
     * probably deprecated
     */
    yTicks: false,


    hover: true,
    tooltip: true,

    hpadding: 0,
    vpadding: 10,

    /*
     * some chart types (line chart) go into a 'compact'
     * mode if the chart width is below this value
     */
    minWidth: 400,

    /*
     * theme locale, probably unused
     */
    locale: 'de_DE',

    /*
     * duration for animated transitions (ms)
     */
    duration: 1000,

    /*
     * easing for animated transitions
     */
     easing: 'expoInOut'

};
}).call(this);

(function() {

    dw.__visMeta = {};

    dw.visualize = (function() {

        var locale = 'en-US',
            metricPrefix = {"3":"k","6":"m","9":"b","12":"t"};

        return function(opts) {

            var chart = dw.chart({
                    type: opts.type,
                    theme: opts.theme,
                    metadata: {
                        visualize: opts.options || {},
                        axes: opts.axes || {}
                    }
                }),
                vis = dw.visualization(opts.type);

            vis.meta = dw.__visMeta[opts.type];
            vis.lang = locale;

            opts.datasource.dataset().done(function(ds) {

                chart.dataset(ds)
                    .locale(locale)
                    .metricPrefix(metricPrefix)
                    .theme(dw.theme(opts.theme))
                    .vis(vis);

                vis.size(opts.container.width(), opts.container.height())
                   .__init()
                   .render(opts.container);
            });
        };

    })();

}).call(this);

dw.__visMeta['data-table'] = {"__static_path": "/static/plugins/visualization-data-table/", "dimensions": 2, "title": "Data Table", "locale": {"sSearch": "Search:", "sInfoThousands": ",", "sInfoEmpty": "Showing 0 to 0 of 0 entries", "sProcessing": "Processing...", "sEmptyTable": "No data available in table", "sInfoFiltered": "(filtered from _MAX_ total entries)", "oPaginate_sPrevious": "Previous", "oPaginate_sNext": "Next", "oAria_sSortAscending": ": activate to sort column ascending", "sZeroRecords": "No matching records found", "sLoadingRecords": "Loading...", "oPaginate_sLast": "Last", "sLengthMenu": "Show _MENU_ entries", "oPaginate_sFirst": "First", "sInfo": "Showing _START_ to _END_ of _TOTAL_ entries", "oAria_sSortDescending": ": activate to sort column descending"}, "options": {"table-paginate": {"type": "checkbox", "label": "Display content over multiple pages"}, "table-filter": {"type": "checkbox", "label": "Show filter"}, "table-sortable": {"type": "checkbox", "label": "Make columns sortable"}}, "libraries": ["vendor/jquery.dataTables.min.js"], "version": "1.5.0", "id": "data-table", "order": 70, "icon": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!-- Generator: Adobe Illustrator 16.2.1, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1 Basic//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11-basic.dtd\">\n<svg version=\"1.1\" baseProfile=\"basic\" id=\"Ebene_1\"\n\t xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" width=\"100px\" height=\"100px\"\n\t viewBox=\"0 0 100 100\" xml:space=\"preserve\">\n<rect x=\"10\" y=\"11\" width=\"79\" height=\"8\"/>\n<line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"36.5\" y1=\"11\" x2=\"36.5\" y2=\"90\"/>\n<line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"64.5\" y1=\"10\" x2=\"64.5\" y2=\"90\"/>\n<line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"10\" y1=\"54.5\" x2=\"89\" y2=\"54.5\"/>\n<line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"10\" y1=\"65.5\" x2=\"89\" y2=\"65.5\"/>\n<line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"10\" y1=\"77.5\" x2=\"89\" y2=\"77.5\"/>\n<line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"10\" y1=\"30.5\" x2=\"89\" y2=\"30.5\"/>\n<line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"11\" y1=\"42.5\" x2=\"90\" y2=\"42.5\"/>\n<line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"10\" y1=\"10\" x2=\"10\" y2=\"90\"/>\n<line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"9\" y1=\"91\" x2=\"89\" y2=\"91\"/>\n<line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"9\" y1=\"11\" x2=\"89\" y2=\"11\"/>\n<line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"89\" y1=\"10\" x2=\"89\" y2=\"92\"/>\n</svg>\n"};
dw.__visMeta['raphael-chart'] = {"libraries": [{"cdn": "//assets-datawrapper.s3.amazonaws.com/vendor/d3-light/3.1.7/d3-light.min.js", "local": "vendor/d3-light.min.js"}, {"cdn": "//assets-datawrapper.s3.amazonaws.com/vendor/chroma-js/0.5.4/chroma.min.js", "local": "vendor/chroma.min.js"}, {"cdn": "//assets-datawrapper.s3.amazonaws.com/vendor/raphael-js/2.1.2/raphael-min.js", "local": "vendor/raphael-2.1.2.min.js"}], "__static_path": "/static/plugins/visualization-raphael-chart/", "id": "raphael-chart", "version": "1.5.0", "icon": "<img src=\"/static/plugins/visualization-raphael-chart//raphael-chart.png\" />"};
dw.__visMeta['column-chart'] = {"__static_path": "/static/plugins/visualization-column-charts/", "dimensions": 1, "title": "Column Chart", "axes": {"labels": {"accepts": ["text", "date"]}, "columns": {"multiple": true, "accepts": ["number"]}}, "id": "column-chart", "version": "1.5.0", "extends": "raphael-chart", "options": {"absolute-scale": {"depends-on": {"chart.min_columns[columns]": 2}, "type": "checkbox", "label": "Use the same scale for all columns"}, "grid-lines": {"default": false, "type": "radio-left", "options": [{"value": "auto", "label": "Automatic"}, {"value": "show", "label": "Show"}, {"value": "hide", "label": "Hide"}], "label": "Grid lines"}, "ignore-missing-values": {"default": false, "type": "checkbox", "label": "Ignore missing values"}, "sort-values": {"type": "checkbox", "label": "Automatically sort bars"}, "reverse-order": {"type": "checkbox", "label": "Reverse order"}, "negative-color": {"depends-on": {"chart.min_value[columns]": "<0"}, "type": "checkbox", "label": "Use different color for negative values"}, "base-color": {"type": "base-color", "label": "Base color"}}, "order": 9, "icon": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!-- Generator: Adobe Illustrator 16.2.1, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1 Basic//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11-basic.dtd\">\n<svg version=\"1.1\" baseProfile=\"basic\" id=\"Ebene_1\"\n\t xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" width=\"100px\" height=\"100px\"\n\t viewBox=\"0 0 100 100\" xml:space=\"preserve\">\n<rect x=\"13\" y=\"47\" width=\"22\" height=\"44\"/>\n<rect x=\"40\" y=\"12\" width=\"21\" height=\"79\"/>\n<rect x=\"67\" y=\"36\" width=\"21\" height=\"55\"/>\n</svg>\n"};
dw.__visMeta['bar-chart'] = {"__static_path": "/static/plugins/visualization-bar-chart/", "dimensions": 1, "title": "Bar Chart", "axes": {"bars": {"multiple": true, "accepts": ["number"]}, "labels": {"accepts": ["text", "date"]}}, "id": "bar-chart", "libraries": [], "version": "1.5.1", "extends": "raphael-chart", "options": {"sort-values": {"type": "checkbox", "label": "Autmatically sort bars"}, "absolute-scale": {"type": "checkbox", "label": "Use the same scale for all columns"}, "reverse-order": {"type": "checkbox", "label": "Reverse order"}, "negative-color": {"depends-on": {"chart.min_value[columns]": "<0"}, "type": "checkbox", "label": "Use different color for negative values"}, "base-color": {"type": "base-color", "label": "Base color"}}, "order": 5, "icon": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!-- Generator: Adobe Illustrator 16.2.1, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1 Basic//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11-basic.dtd\">\n<svg version=\"1.1\" baseProfile=\"basic\" id=\"Ebene_1\"\n\t xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" width=\"100px\" height=\"100px\"\n\t viewBox=\"0 0 100 100\" xml:space=\"preserve\">\n<rect x=\"11\" y=\"11.291\" width=\"38\" height=\"11.348\"/>\n<rect x=\"11\" y=\"27.952\" width=\"64\" height=\"11.347\"/>\n<rect x=\"11\" y=\"44.612\" width=\"80\" height=\"11.347\"/>\n<rect x=\"11\" y=\"61.272\" width=\"54\" height=\"11.348\"/>\n<rect x=\"11\" y=\"77.933\" width=\"43\" height=\"11.348\"/>\n</svg>\n"};
dw.__visMeta['line-chart'] = {"__static_path": "/static/plugins/visualization-line-chart/", "dimensions": 2, "title": "Line Chart", "locale": {"tooManyLinesToLabel": "Your chart contains <b>more lines than we can label</b>, so automatic labeling is turned off. To fix this <ul><li>filter some columns in the data table in the previous step, or</li><li>use direct labeling and the highlight feature to label the lines that are important to your story.</li></ul>", "couldNotParseAllDates": "Some of the <b>dates in your x-axis could not be parsed</b>, hence the line chart cannot display a proper date axis. To fix this<ul><li>return to the previous step and clean your date column.</li><li><a href='http://blog.datawrapper.de/2013/cleaning-your-data-in-datawrapper/'>Read more about how to do this.</a></li></ul>", "useLogarithmicScale": "Use logarithmic scale"}, "axes": {"y1": {"multiple": true, "accepts": ["number"]}, "x": {"accepts": ["text", "date"]}, "y2": {"multiple": true, "accepts": ["number"], "optional": true}}, "id": "line-chart", "options": {"sep-y-axis": {"type": "separator", "label": "Customize y-Axis"}, "sep-labeling": {"depends-on": {"chart.min_columns[y1]": 2}, "type": "separator", "label": "Customize labeling"}, "direct-labeling": {"default": false, "depends-on": {"chart.min_columns[y1]": 2, "chart.max_columns[y2]": 0}, "type": "checkbox", "help": "Show the labels right nearby the line ends instead of a separate legend", "label": "Direct labeling"}, "fill-between": {"default": false, "depends-on": {"chart.min_columns[y1]": 2, "chart.max_columns[y1]": 2, "chart.max_columns[y2]": 0}, "type": "checkbox", "label": "Fill area between lines"}, "force-banking": {"hidden": true, "type": "checkbox", "label": "Bank the lines to 45 degrees"}, "invert-y-axis": {"default": false, "type": "checkbox", "label": "Invert direction"}, "line-mode": {"default": "straight", "type": "radio-left", "options": [{"value": "straight", "label": "Straight"}, {"value": "curved", "label": "Curved"}, {"value": "stepped", "label": "Stepped"}], "label": "Line interpolation"}, "fill-below": {"depends-on": {"chart.max_columns[y1]": 1, "chart.max_columns[y2]": 0}, "defaut": false, "type": "checkbox", "label": "Fill area below line"}, "legend-position": {"default": "right", "depends-on": {"chart.min_columns[y1]": 2, "direct-labeling": false}, "type": "radio-left", "options": [{"value": "right", "label": "right"}, {"value": "top", "label": "top"}, {"value": "inside", "label": "inside left"}, {"value": "inside-right", "label": "inside right"}], "label": "Legend position"}, "sep-lines": {"type": "separator", "label": "Customize lines"}, "scale-y1": {"default": "linear", "depends-on": {"chart.min_value[y1]": ">0", "chart.magnitude_range[y1]": ">3"}, "type": "radio-left", "options": [{"value": "linear", "label": "linear"}, {"value": "log", "label": "logarithmic"}], "label": "Scale (y-axis)"}, "connect-missing-values": {"type": "checkbox", "label": "Connect lines between missing values"}, "extend-range": {"type": "checkbox", "help": "Extend the y-axis range to nice, rounded values instead of the default range from the minimum to maximum value.", "label": "Extend to nice ticks"}, "baseline-zero": {"type": "checkbox", "label": "Extend to zero"}, "show-grid": {"default": false, "hidden": true, "type": "checkbox", "label": "Show grid"}, "user-change-scale": {"default": false, "depends-on": {"chart.min_value[y1]": ">0", "chart.magnitude_range[y1]": ">3"}, "type": "checkbox", "label": "Let user change scale"}, "base-color": {"type": "base-color", "label": "Base color"}}, "extends": "raphael-chart", "annotations": [{"type": "axis-range", "axis": "x"}, {"type": "axis-point", "axis": "x"}, {"type": "axis-range", "axis": "y"}, {"type": "axis-point", "axis": "y"}, {"type": "data-point"}], "version": "1.5.0", "order": 40, "icon": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!-- Generator: Adobe Illustrator 16.2.1, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1 Basic//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11-basic.dtd\">\n<svg version=\"1.1\" baseProfile=\"basic\" id=\"Ebene_1\"\n\t xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" width=\"100px\" height=\"100px\"\n\t viewBox=\"0 0 100 100\" xml:space=\"preserve\">\n<g>\n\t<line fill=\"none\" stroke=\"#000000\" stroke-width=\"0.5\" stroke-miterlimit=\"10\" x1=\"9\" y1=\"79.5\" x2=\"91\" y2=\"79.5\"/>\n\t<line fill=\"none\" stroke=\"#000000\" stroke-width=\"0.5\" stroke-miterlimit=\"10\" x1=\"9\" y1=\"59.5\" x2=\"91\" y2=\"59.5\"/>\n\t<line fill=\"none\" stroke=\"#000000\" stroke-width=\"0.5\" stroke-miterlimit=\"10\" x1=\"9\" y1=\"39.5\" x2=\"91\" y2=\"39.5\"/>\n\t<line fill=\"none\" stroke=\"#000000\" stroke-width=\"0.5\" stroke-miterlimit=\"10\" x1=\"9\" y1=\"19.5\" x2=\"91\" y2=\"19.5\"/>\n</g>\n<line fill=\"none\" stroke=\"#000000\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" x1=\"10\" y1=\"75.814\" x2=\"35.937\" y2=\"42.674\"/>\n<line fill=\"none\" stroke=\"#000000\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" x1=\"35.937\" y1=\"42.674\" x2=\"62.719\" y2=\"55.584\"/>\n<line fill=\"none\" stroke=\"#000000\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" x1=\"62.719\" y1=\"55.584\" x2=\"90.562\" y2=\"23.755\"/>\n</svg>\n"};
dw.__visMeta['maps'] = {"__static_path": "/static/plugins/visualization-maps/", "version": "0.9.5", "title": "Map (beta)", "locale": {"ids-mismatching": "A significant fraction of your data (%d) could not be assigned to regions of the chosen map. Please make sure that <ul><li>you have selected the correct map and</li><li>that your dataset uses the same identifiers as used in the map.</li></ul>\n                    <p>You may find this <a download='template.csv' href='%t'>template dataset useful</a>.</li></ul>"}, "axes": {"keys": {"accepts": ["text", "number"], "title": "Key"}, "color": {"accepts": ["number", "text"], "title": "Color"}, "tooltip": {"optional": true, "multiple": true, "accepts": ["text", "number", "date"], "title": "Tooltip"}}, "id": "maps", "libraries": [{"cdn": "//assets-datawrapper.s3.amazonaws.com/vendor/kartograph-js/0.8.3/kartograph.min.js", "local": "vendor/kartograph.min.js"}, {"cdn": "//assets-datawrapper.s3.amazonaws.com/vendor/qtip/2.1.1/jquery.qtip.min.js", "local": "vendor/jquery.qtip.min.js"}], "options": {"map": {"type": "map-selector", "options": [{"keys": ["AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "XK", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SS", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW", "CS", "AN"], "path": "plugins/visualization-maps/maps/1-world", "has_locale": true, "value": "1-world", "label": "Welt"}, {"keys": ["AL", "AD", "AT", "BE", "BG", "BA", "BY", "CH", "CY", "CZ", "DE", "DK", "ES", "EE", "FI", "FR", "FO", "GB", "GE", "GG", "GR", "HR", "HU", "IM", "IE", "IS", "IT", "JE", "JO", "LI", "LT", "LU", "LV", "MC", "MD", "MK", "MT", "ME", "NL", "NO", "PL", "PT", "RO", "RU", "RS", "SK", "SI", "SE", "TR", "UA", "VA"], "path": "plugins/visualization-maps/maps/2-europe", "has_locale": true, "value": "2-europe", "label": "Europa"}, {"keys": ["AGO", "ARE", "BDI", "BEN", "BFA", "BHR", "BWA", "CAF", "CIV", "CMR", "COD", "COG", "COM", "DJI", "DZA", "EGY", "ERI", "ETH", "FRA", "GAB", "GAZ", "GHA", "GIN", "GMB", "GNB", "GNQ", "ISR", "JOR", "KEN", "KWT", "LBN", "LBR", "LBY", "LSO", "MAR", "MDG", "MLI", "MOZ", "MRT", "MWI", "NAM", "NER", "NGA", "OMN", "PR1", "QAT", "RWA", "SAH", "SAU", "SDN", "SDS", "SEN", "SHN", "SLE", "SOL", "SOM", "STP", "SWZ", "SYC", "TCD", "TGO", "TUN", "TZA", "UGA", "WEB", "YEM", "ZAF", "ZMB", "ZWE"], "path": "plugins/visualization-maps/maps/3-africa", "has_locale": true, "value": "3-africa", "label": "Afrika"}, {"keys": ["ATG", "AIA", "ABW", "BRB", "BLM", "BMU", "BES", "BHS", "BLZ", "CAN", "CRI", "CUB", "CUW", "DMA", "DOM", "GRD", "GRL", "GLP", "GTM", "HND", "HTI", "JAM", "KNA", "CYM", "LCA", "MAF", "MTQ", "MSR", "MEX", "NIC", "PAN", "SPM", "PRI", "SLV", "SXM", "TCA", "TTO", "USA", "VCT", "VGB", "VIR", "ANT"], "path": "plugins/visualization-maps/maps/4-north-america", "has_locale": true, "value": "4-north-america", "label": "Nordamerika"}, {"keys": ["ARG", "BOL", "BRA", "CHL", "COL", "ECU", "FLK", "GUF", "GUY", "PER", "PRY", "SUR", "URY", "VEN", "FRA", "PAN"], "path": "plugins/visualization-maps/maps/5-south-america", "has_locale": true, "value": "5-south-america", "label": "S\u00fcdamerika"}, {"keys": ["AK", "AL", "AR", "AZ", "CA", "CO", "CT", "DC", "DE", "FL", "GA", "HI", "IA", "ID", "IL", "IN", "KS", "KY", "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE", "NH", "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY"], "path": "plugins/map-us-admin/us-states", "has_locale": true, "value": "de-states", "label": "Vereinigte Staaten von Amerika"}], "label": "Base map"}, "map-keys": {"axes": [{"id": "keys", "label": "Map key column"}], "type": "select-axis-column", "help": "Please select the column which contains the <b>map region keys</b>."}, "gradient": {"help": "Here you can define a <b>color gradient</b> from which map colors are picked according to the <b>classification</b>.", "color-axis": "color", "depends-on": {"chart.column_type[color]": "number"}, "use-classes": true, "label": "Color gradient", "type": "color-gradient-selector"}, "category-colors": {"keys": "color", "depends-on": {"chart.column_type[color]": "text"}, "type": "color-category-selector", "help": "Here you can select a palette from which the category colors are picked. On top of that you can assign custom colors for each category.", "label": "Category colors"}, "map-data": {"axes": [{"id": "color", "label": "Data column"}], "type": "select-axis-column", "help": "Please select the data columns that contain the <b>data values</b> to be displayed in the map."}, "---map-options---": {"type": "separator", "label": "Configure the map"}}, "extends": "raphael-chart", "order": 92, "icon": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!-- Generator: Adobe Illustrator 16.2.1, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1 Basic//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11-basic.dtd\">\n<svg version=\"1.1\" baseProfile=\"basic\" id=\"Ebene_1\"\n\t xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" width=\"100px\" height=\"100px\"\n\t viewBox=\"0 0 100 100\" xml:space=\"preserve\">\n<path d=\"M79.432,82.326c-0.063,0-0.125-0.034-0.16-0.088l-0.946-1.459l-0.233-0.811l-0.137-3.573\n\tc-0.004-0.12-0.05-0.235-0.127-0.324c-0.046-0.05-0.064-0.108-0.056-0.164l0.212-1.397c0.008-0.054,0.039-0.102,0.085-0.131\n\tc0.031-0.02,0.065-0.03,0.102-0.03c0.101,0.022,0.16,0.056,0.176,0.07c0.053,0.047,0.704,0.59,0.704,0.59l0.377,0.294l0.062,0.082\n\tl0.109,0.274c0.018,0.046,0.017,0.099-0.004,0.146c-0.019,0.041-0.027,0.086-0.025,0.131l0.008,0.214l-0.148,1.042\n\tc-0.019,0.136,0.012,0.269,0.084,0.366l0.657,1.825c0.016,0.137-0.021,0.241-0.316,0.319c-0.148,0.04-0.242,0.185-0.22,0.336\n\tl0.212,1.378c0.007,0.04,0,0.081-0.02,0.118l-0.184,0.352c-0.034,0.063-0.043,0.138-0.026,0.208c0.02,0.082-0.02,0.168-0.095,0.207\n\tL79.432,82.326z\"/>\n<path d=\"M34.809,74.384c-0.053,0-0.102-0.021-0.137-0.058l-0.4-0.418c-0.033-0.034-0.053-0.082-0.053-0.13v-0.141\n\tc0-0.049,0.019-0.096,0.053-0.132l0.13-0.137c0.037-0.038,0.086-0.06,0.138-0.06h0.268l0.355,0.16\n\tc0.062,0.032,0.103,0.098,0.103,0.168v0.418c0,0.071-0.04,0.137-0.103,0.169l-0.268,0.139L34.809,74.384z\"/>\n<path d=\"M63.268,61.184c-0.028,0-0.058-0.008-0.083-0.021l-0.199-0.101l-2.277-0.932c-0.071-0.029-0.118-0.099-0.118-0.176\n\tc-0.05-0.197-0.128-0.267-0.275-0.391c-0.035-0.029-0.09-0.062-0.135-0.073c-0.046-0.012-0.072-0.021-0.097-0.037\n\tc-0.07-0.045-0.104-0.128-0.084-0.207c0.02-0.08,0.089-0.138,0.171-0.145l1.386-0.102c0.089-0.007,0.295-0.054,0.39-0.323l1.4-3.797\n\tc0.027-0.074,0.099-0.124,0.178-0.124c1.516,0.214,1.516,0.214,1.538,0.214c0.196,0,0.362-0.103,0.444-0.274l0.298-0.623\n\tc0.031-0.064,0.099-0.107,0.171-0.107l3.012,0.703c0.089,0.021,0.15,0.102,0.147,0.193c-0.007,0.137,0.044,0.274,0.138,0.376\n\tc0.023,0.025,0.08,0.09,0.104,0.127l0.392,0.819c0.025,0.054,0.024,0.116-0.003,0.17l-0.655,1.254l-0.499,0.529\n\tc-0.066,0.071-0.111,0.158-0.132,0.256l-0.241,1.256c-0.057,0.116-0.119,0.176-0.144,0.188c-0.026,0.014-0.064,0.038-0.086,0.06\n\tl-0.448,0.445c-0.032,0.033-0.066,0.053-0.104,0.061l-1.133,0.237L63.268,61.184z M56.312,60.132c-0.067,0-0.129-0.036-0.163-0.095\n\tc-0.075-0.125-0.193-0.208-0.329-0.233l-1.204-0.208c-0.068-0.012-0.125-0.06-0.146-0.126c-0.021-0.061-0.014-0.144,0.014-0.187\n\tl0.056-0.086c0.063-0.163,0.166-0.249,0.246-0.249c0,0,2.91,0.328,2.911,0.328c0.068,0,1.075-0.079,1.129-0.082\n\tc0.077,0,0.159,0.071,0.173,0.165c0.014,0.095-0.051,0.188-0.147,0.21l-2.496,0.559L56.312,60.132z\"/>\n<path d=\"M45.699,49.947c-0.06,0-0.115-0.027-0.151-0.074l-0.768-1l-3.624-3.104c-0.049-0.042-0.074-0.104-0.066-0.167\n\tc0.007-0.062,0.045-0.118,0.102-0.147l0.344-0.179l0.161-0.008l1.11,0.462l0.22,0.38c0.056,0.095,0.156,0.149,0.26,0.149\n\tc0.042,0,0.084-0.009,0.125-0.027c0.141-0.064,0.209-0.225,0.158-0.372l-0.062-0.179l0.512-0.179\n\tc0.019-0.001,0.036-0.002,0.052-0.002c0.081,0,0.121,0.021,0.15,0.054l1.709,1.9c0.063,0.069,0.145,0.119,0.237,0.144\n\tc0.157,0.109,0.259,0.148,0.37,0.15c0.048,0.001,0.096,0.021,0.129,0.056l0.095,0.096c0.042,0.043,0.061,0.105,0.051,0.166\n\tl-0.128,0.73c-0.013,0.073-0.068,0.132-0.14,0.151l-0.117,0.03c-0.145,0.039-0.264,0.146-0.321,0.289l-0.231,0.562\n\tc-0.026,0.063-0.083,0.108-0.15,0.117L45.699,49.947z\"/>\n<path d=\"M86.553,76.413c-0.056,0-0.109-0.025-0.146-0.069c-0.041-0.049-0.055-0.115-0.035-0.174l0.09-0.284\n\tc0.063-0.201,0-0.425-0.158-0.558l-1.496-1.272c-0.042-0.036-0.067-0.09-0.067-0.145l-0.112-1.233\n\tc-0.006-0.068,0.025-0.137,0.083-0.176l0.098-0.064c0.168-0.093,0.257-0.301,0.221-0.544l-0.678-3.699\n\tc-0.009-0.05,0.003-0.103,0.032-0.142c0.033-0.046,0.078-0.073,0.129-0.079l7.291-0.979c0.069-0.009,0.134-0.042,0.181-0.094\n\tc0.033-0.036,0.083-0.058,0.135-0.058c0.023,0.011,0.126,0.034,0.151,0.038c0,0,0.034,0.007,0.07,0.015\n\tc-0.025,0.088-0.04,0.146-0.041,0.209c-0.001,0.039,0.004,0.075,0.011,0.109c-0.073,0.012-0.029,0.025-0.184,0.037\n\tC91.971,67.263,92,67.394,92,67.55v5.833c0,0.159-0.025,0.291,0.135,0.3c0.168,0.009,0.209,0.018,0.289,0.026\n\tc0.003,0.028-0.028,0.059-0.018,0.089c0.046,0.142,0.156,0.196,0.234,0.229c0-0.001-0.031-0.021-0.054-0.056\n\tc0.011,0.018,0.02,0.034,0.034,0.049l0.086,0.084c0.101,0.096,0.215,0.204,0.223,0.284l0.117,0.732\n\tc0.005,0.058-0.018,0.147-0.102,0.182l-1.167,0.472L86.553,76.413z\"/>\n<path d=\"M74.053,72.891c-0.051,0-0.1-0.021-0.135-0.059l-5.13-5.346c-0.067-0.069-0.071-0.178-0.009-0.252l0.314-0.379\n\tc0.036-0.042,0.09-0.067,0.146-0.067c0.04,0.001,5.76,0.129,5.76,0.129c0.082,0.002,0.152,0.055,0.177,0.132l0.251,0.779\n\tl0.436,2.521c0.012,0.066-0.012,0.133-0.064,0.177c-0.025,0.021-0.048,0.048-0.065,0.077l-0.982,1.666l-0.333,0.251\n\tc-0.084,0.058-0.148,0.143-0.188,0.244c-0.022,0.062-0.075,0.108-0.139,0.121L74.053,72.891z\"/>\n<path d=\"M82.672,42.311c-0.07,0-0.134-0.038-0.167-0.099l-0.815-1.496c-0.034-0.062-0.029-0.14,0.011-0.198l0.797-1.166\n\tc0.08-0.113,0.096-0.278,0.04-0.459l-0.975-2.998l-0.307-0.528c-0.028-0.046-0.035-0.101-0.021-0.154\n\tc0.014-0.048,0.049-0.089,0.096-0.113l3.366-1.718c0.295-0.16,0.303-0.245,0.303-0.45v-1.687c0-0.044,0.123-0.122,0.092-0.185\n\tc0.154-0.441,0.767-1.981,0.795-2.058c0.043-0.121,0.151-0.126,0.175-0.128c0.055,0.034,0.157,0.056,0.234,0.056\n\tc0.037,0,0.081-0.005,0.109-0.016c0.089-0.035,0.208-0.095,0.233-0.188c0.032-0.123,0.064-0.222,0.107-0.289l0.768-1.605\n\tc0.031-0.066,0.099-0.108,0.172-0.108c0.078,0.006,4.521,0.348,4.521,0.348c0.052,0.004,0.099,0.027,0.13,0.066\n\tc0.034,0.041,0.05,0.09,0.045,0.138l-0.073,0.734l0.002,11.741c0,0.1-0.075,0.182-0.175,0.189l-3.028,0.234\n\tc-0.046,0.004-0.091,0.018-0.13,0.042L82.732,42.3L82.672,42.311z\"/>\n<path d=\"M48.531,62.956c-0.073,0-0.141-0.043-0.171-0.108l-0.255-0.535c-0.043-0.091-0.129-0.154-0.229-0.168\n\tc-0.058-0.009-0.108-0.042-0.138-0.092c-0.024-0.041-0.032-0.091-0.021-0.139c0.003-0.017,0.012-0.127,0.013-0.143\n\tc0.024-0.442,0.118-0.442,0.209-0.442c0.031,0.01,0.065,0.014,0.102,0.014c0.098,0,0.205-0.033,0.261-0.101l1.545-1.826\n\tc0.033-0.039,0.093-0.112,0.121-0.129l0.885,0.013c0.16,0,0.148-0.125,0.148-0.284c0-0.009,0-0.018,0-0.026s0.258-0.028,0.293-0.05\n\tl0.658-0.367l0.149-0.018l1.28,0.246c0.096,0.018,0.174,0.107,0.168,0.206c-0.005,0.081-0.058,0.152-0.136,0.173\n\tc-0.155,0.04-0.249,0.196-0.215,0.354c0.009,0.041,0.005,0.085-0.014,0.123c-0.091,0.201,0.015,0.439,0.157,0.589l0.189,0.643\n\tc0.085,0.16,0.267,0.505,0.267,0.505c0.054,0.099,0.156,0.155,0.263,0.155c0.041,0,0.082-0.008,0.121-0.025l0.708-0.313\n\tc0.022-0.002,0.042-0.004,0.061-0.004c0.11,0,0.164,0.04,0.19,0.098c0.043,0.093,0.002,0.205-0.092,0.25l-2.506,1.195\n\tc-0.026,0.003-0.05,0.004-0.07,0.004c-0.099,0-0.146-0.031-0.173-0.078l-0.454-0.757c-0.033-0.047-0.071-0.089-0.111-0.124\n\tl-0.062-0.453c-0.024-0.146-0.15-0.34-0.296-0.34c-0.006,0-0.013,0-0.02,0c-0.153,0-0.274,0.225-0.28,0.377l-0.012,0.353\n\tl-2.455,1.187L48.531,62.956z\"/>\n<path d=\"M63.513,53.724c-0.051-0.007-0.095-0.034-0.126-0.077l-2.951-4.056c-0.049-0.068-0.048-0.161,0.003-0.227l0.089-0.115\n\tc0.021-0.028,0.053-0.05,0.087-0.062l4.42-1.578c0.001,0,0.161,0.016,0.162,0.016l3.443,2.102l0.233,0.416\n\tc0.055,0.097,0.156,0.152,0.262,0.152c0.04,0,0.08-0.008,0.119-0.024c0.141-0.061,0.213-0.218,0.167-0.365l-0.088-0.284\n\tc0.013-0.02,0.025-0.041,0.035-0.062l0.204-0.424c0.023-0.049,0.067-0.086,0.12-0.101c0.018-0.001,0.033-0.002,0.048-0.002\n\tc0.055,0,0.085,0.01,0.11,0.027l2.782,1.836c0.045,0.03,0.075,0.078,0.082,0.132c0.008,0.056-0.008,0.11-0.044,0.152l-0.877,1.005\n\tl-0.446,0.465l-1.693,0.957c-0.053,0.042-0.1,0.07-0.142,0.089c-0.033-0.025-0.074,0.1-0.125,0.089L65.721,53\n\tc-0.006,0-0.013,0-0.02,0c-0.349,0-0.467,0.096-0.513,0.188l-0.322,0.645c-0.032,0.066-0.105,0.084-0.169,0.084\n\tc-0.019,0-0.048-0.014-0.075-0.009L63.513,53.724z\"/>\n<path d=\"M51.436,58.867C51.338,58.855,51.287,59,51.235,59h-0.72c-0.045,0-0.09-0.146-0.133-0.141l1.14-4.15\n\tc0.084-0.247-0.006-0.787-0.172-0.97l-3.476-2.207c-0.031-0.02-0.07-0.063-0.083-0.122l-0.326-1.451\n\tc-0.019-0.083,0.021-0.171,0.097-0.211c0.036-0.019,0.134-0.082,0.16-0.113c0.057-0.052,0.13-0.176,0.136-0.253l0.106-1.472\n\tc0.035-0.208,0.021-0.302,0.003-0.361c-0.014-0.045-0.038-0.087-0.071-0.121c-0.024-0.025-0.047-0.059-0.044-0.129l0.007-0.243\n\tl0.252-2.05c0.01-0.086-0.017-0.169-0.069-0.23l-0.352-0.743c-0.025-0.054-0.024-0.117,0.003-0.169l2.403-4.545\n\tc0.028-0.054,0.082-0.091,0.144-0.099l1.707-0.224c0.196-0.025,0.358-0.184,0.402-0.394l0.888-4.238\n\tc0.011-0.05,0.041-0.094,0.086-0.122c0.03-0.02,0.063-0.029,0.1-0.029l0.21,0.049l0.793,0.105c0.042,0.006,0.081,0.025,0.109,0.056\n\tc0.042,0.046,0.098,0.078,0.158,0.091l5.36,1.142l0.625,0.109c0.036,0.006,0.07,0.023,0.099,0.049l2.096,1.94\n\tc0.029,0.027,0.049,0.061,0.059,0.102l1.107,5.01c0.007,0.032,0.006,0.067-0.004,0.098l-0.208,0.648\n\tc-0.03,0.086-0.035,0.187-0.011,0.283l0.563,2.707c0.02,0.092-0.033,0.186-0.122,0.218l-4.131,1.478\n\tc-0.089,0.031-0.163,0.085-0.22,0.159l-0.531,0.694c-0.14,0.181-0.144,0.438-0.011,0.623l3.145,4.324\n\tc0.038,0.052,0.047,0.117,0.024,0.177L61.186,57.9c-0.026,0.071-0.089,0.118-0.165,0.125l-3.251,0.242l-3.752-0.414l-0.195-0.085\n\tl-1.246-0.365c-0.027-0.008-0.055-0.012-0.083-0.012c-0.055,0-0.108,0.015-0.156,0.043c-0.071,0.044-0.121,0.115-0.138,0.198\n\tc-0.035,0.175-0.068,0.37-0.123,0.427L51.436,58.867z\"/>\n<path d=\"M58.01,34.794c-0.027,0-0.068-0.006-0.107-0.034l-0.8-0.558c-0.058-0.04-0.088-0.107-0.081-0.175\n\tc0.008-0.07,0.052-0.129,0.115-0.155l0.668-0.276c0.033,0.013,0.075,0.019,0.12,0.019c0.097,0,0.205-0.03,0.263-0.085\n\tc0.083-0.08,0.183-0.202,0.146-0.312l-0.77-2.305c-0.019-0.056-0.01-0.117,0.023-0.167c0.032-0.048,0.087-0.079,0.146-0.083\n\tc0.001,0,2.229-0.136,2.293-0.139c0.045,0,0.102,0.028,0.136,0.075c0.04,0.053,0.05,0.119,0.028,0.179\n\tc-0.042,0.118-0.016,0.27,0.08,0.351c0.078,0.136,0.063,0.217,0.012,0.271l-0.134,0.141c-0.027,0.028-0.062,0.047-0.101,0.055\n\tc-0.098,0.02-0.18,0.088-0.218,0.181l-0.793,1.951C58.949,33.71,58.883,33.7,58.81,33.7c-0.152,0-0.264,0.078-0.336,0.135l0,0\n\tc-0.044,0-0.088,0.009-0.129,0.029c-0.112,0.054-0.18,0.171-0.17,0.294l0.021,0.259c0.018,0.116-0.035,0.249-0.085,0.28\n\tc-0.007,0.004-0.08,0.056-0.086,0.061L58.01,34.794z M56.144,34.099c-0.03,0-0.061-0.008-0.088-0.022l-0.265-0.137\n\tc-0.036-0.019-0.065-0.049-0.083-0.085l-0.137-0.28c-0.004-0.142-0.116-0.302-0.257-0.327c-0.026-0.004-0.054-0.007-0.08-0.007\n\tc-0.113,0-0.218,0.045-0.261,0.152l-0.043,0.108c-0.03,0.078-0.027,0.166,0.01,0.241c0.071,0.147,0.064,0.22,0.023,0.276\n\tc-0.036,0.051-0.093,0.08-0.153,0.08l-1.073-0.197l-0.484-0.033C53.22,33.856,53.185,34,53.149,34h-0.34\n\tc-0.218,0-0.477-0.221-0.528-0.277l0.016-0.261c0.001,0.013,0.006-0.02,0.013-0.02c0.012,0,0.03-0.034,0.043-0.045\n\tc0.052-0.042,0.104-0.096,0.147-0.151l4.079-5.142c0.027-0.036,0.117-0.078,0.192-0.078c0.038,0,0.091,0.01,0.117,0.025\n\tc0.081,0.046,0.121,0.149,0.089,0.231l-0.54,1.385c-0.043,0.109-0.018,0.232,0.063,0.317l0.178,0.184\n\tc0.047,0.049,0.064,0.121,0.044,0.184c-0.001,0.003-0.126,0.4-0.143,0.446c-0.04,0.116-0.007,0.25,0.087,0.33\n\tc0.045,0.039,0.069,0.096,0.065,0.154l-0.132,1.945c-0.005,0.07-0.05,0.133-0.115,0.161c-0.078,0.033-0.152,0.103-0.18,0.183\n\tc-0.028,0.08-0.035,0.173,0.005,0.248c0.035,0.065,0.029,0.145-0.015,0.204C56.26,34.07,56.203,34.099,56.144,34.099z\"/>\n<path d=\"M14.973,91.356c-0.051,0-0.101-0.021-0.138-0.06l-3.695-3.85c-0.039-0.04-0.088-0.068-0.142-0.083\n\tc-0.001,0-0.12-0.057-0.122-0.057c-0.093-0.031-0.155-0.131-0.138-0.221l1.394-7.132c0.013-0.064,0.058-0.118,0.12-0.142\n\tl1.114-0.421c0.163-0.062,0.28-0.213,0.309-0.392l1.068-6.807c0.04-0.262-0.12-0.514-0.363-0.576l-3.714-0.903\n\tc-0.09-0.021-0.15-0.104-0.145-0.194l0.197-3.189c0.005-0.077,0.055-0.143,0.127-0.167l0.208-0.071c0.001,0,0.101-0.007,0.101-0.007\n\tl15.961,3.299c0.014,0.003,0.108,0.003,0.114,0.003c0.079,0,0.157,0.026,0.176,0.04l2.852,2.229\n\tc0.032,0.025,0.069,0.043,0.108,0.054l3.422,0.904c0.082,0.021,0.14,0.095,0.143,0.178c0.004,0.132,0.055,0.253,0.141,0.344\n\tl0.402,0.417c0.092,0.094,0.213,0.146,0.334,0.146c0.05,0,0.1-0.013,0.144-0.036c0.03-0.018,0.113-0.042,0.194-0.042l1.667,0.568\n\tc0.067,0.023,0.116,0.084,0.125,0.154c0.009,0.072-0.021,0.143-0.081,0.182l-4.975,3.383l-2.5,3.01\n\tc-0.081,0.1-0.122,0.223-0.119,0.351l0.123,3.335c0.001,0.048-0.014,0.093-0.044,0.128l-2.917,3.419l-4.809,1.999l-0.11,0.011\n\tL17.7,90.368c-0.02-0.004-0.041-0.006-0.061-0.006c-0.037,0-0.073,0.007-0.108,0.02l-2.485,0.959L14.973,91.356z\"/>\n<path d=\"M82.497,20.632l-1.138-0.4c-0.031-0.011-0.107-0.019-0.141-0.019c-0.12,0-0.219,0.034-0.302,0.103l-0.54,0.438\n\tc-0.034,0.027-0.076,0.042-0.12,0.042c-0.089-0.014-0.138-0.048-0.164-0.096l-1.614-2.87c-0.05-0.087-0.023-0.194,0.059-0.25\n\tl2.385-1.622c0.026-0.018,0.062-0.03,0.096-0.032c0,0,3.065-0.206,3.143-0.21c0.036,0,0.088,0.023,0.125,0.062\n\tc0.036,0.04,0.055,0.099,0.047,0.156l-0.259,1.784c-0.012,0.077-0.004,0.16,0.021,0.242l0.885,2.759\n\tc-0.003,0.156-0.05,0.239-0.075,0.258c-0.09,0.066-0.144,0.08-0.157,0.081L82.497,20.632z\"/>\n<path d=\"M77.433,15c-0.059,0-0.097-0.259-0.13-0.282l-3.259-2.336c-0.053-0.036-0.084-0.158-0.083-0.223l0.114-5.983\n\tC74.097,6.176,74.267,6,74.267,6h11.721c0.024,0,0.048,0.148,0.07,0.146l-2.607,5.622c-0.006,0.012-0.02,0.309-0.095,0.343\n\tL77.489,15H77.433z\"/>\n<path d=\"M37.094,74.224l-1.418-0.492c-0.068-0.023-0.118-0.086-0.127-0.158c-0.019-0.166-0.121-0.315-0.265-0.388l-0.266-0.14\n\tc-0.043-0.022-0.091-0.034-0.14-0.034c-0.081,0-0.198-0.06-0.223-0.095c-0.073-0.1-0.166-0.162-0.273-0.188l-3.596-0.938\n\tl-2.447-1.89c-0.065-0.052-0.09-0.14-0.06-0.218l1.372-3.638l0.565-5.832l-0.811-3.641c-0.029-0.133-0.109-0.247-0.224-0.32\n\tl-3.93-2.376c-0.038-0.022-0.066-0.058-0.08-0.098l-0.467-1.321c-0.022-0.063-0.011-0.133,0.032-0.185\n\tc0.036-0.044,0.089-0.069,0.146-0.069c5.89,0.822,5.89,0.822,5.913,0.822c0.139,0,0.255-0.049,0.347-0.145\n\tc0.103-0.103,0.157-0.261,0.14-0.419l-0.256-2.312c-0.008-0.07,0.023-0.138,0.082-0.178c0.032-0.021,0.068-0.033,0.106-0.033\n\tl2.311,1.224c0.043,0.023,0.181,0.047,0.231,0.047c0.111,0,0.204-0.033,0.284-0.101l5.86-4.91c0.043-0.037,0.09-0.044,0.122-0.044\n\tc0.045,0,0.088,0.016,0.123,0.045l3.912,3.333l1.583,2.057c0.065,0.087,0.163,0.15,0.266,0.174c0.041,0.009,0.076,0.027,0.103,0.056\n\tl0.591,0.321c0.043,0.022,0.09,0.033,0.138,0.033c0.041,0,0.081-0.008,0.12-0.024c0.009-0.004,0.059-0.016,0.143-0.016\n\tc0.091,0,0.144,0.013,0.155,0.018c0.029,0.011,0.074,0.024,0.104,0.026c0.032,0.002,0.111,0.024,0.138,0.04l2.952,1.708\n\tc0.079,0.046,0.115,0.141,0.084,0.226c0,0.001-1.239,3.524-1.289,3.678c-0.037,0.067-0.11,0.166-0.768,1.042l-2.608,3.478\n\tc-0.147,0.197-0.135,0.48,0.028,0.66c0.087,0.1,0.214,0.157,0.346,0.157c0.058,0,0.114-0.017,0.162-0.048l0.662-0.426\n\tc0.042-0.029,0.079-0.041,0.118-0.041c0.102,0.021,0.147,0.059,0.171,0.108l0.314,0.654c0.023,0.048,0.024,0.105,0.003,0.155\n\tc-0.014,0.034-0.022,0.07-0.023,0.106l-0.15,5.361c-0.005,0.175,0.079,0.342,0.217,0.436l0.575,0.402\n\tc0.04,0.027,0.067,0.068,0.078,0.116l0.088,0.413c0.012,0.057-0.001,0.113-0.037,0.158c-0.035,0.044-0.088,0.07-0.146,0.071\n\tL41.2,70.773c-0.059,0.001-0.115,0.02-0.164,0.052l-2.887,1.973c-0.153,0.108-0.234,0.291-0.214,0.479l0.074,0.691\n\tc0.005,0.05-0.01,0.102-0.043,0.142c-0.031,0.038-0.079,0.062-0.132,0.067c-0.001,0-0.592,0.051-0.684,0.058\n\tC37.132,74.234,37.113,74.23,37.094,74.224z\"/>\n<path d=\"M32.008,48c-0.171,0-0.218-0.542-0.27-1.14l-0.023-0.455c-0.015-0.154-0.145-0.309-0.298-0.309\n\tc-0.008,0-3.145,0.22-3.233,0.226c-0.016,0-0.079-0.044-0.131-0.109C28.015,46.167,28,46.083,28.02,46.02l0.958-3.144\n\tc0.096-0.251,0.012-0.53-0.211-0.656l-1.041-0.592c-0.07-0.04-0.107-0.12-0.093-0.199l0.659-3.664\n\tc0.009-0.049,0.038-0.094,0.08-0.124l2.165-1.503c0.127-0.087,0.208-0.235,0.215-0.396l0.266-4.86\n\tc0.013-0.248-0.143-0.468-0.371-0.522l-2.2-0.52c-0.051-0.012-0.096-0.046-0.122-0.093c-0.026-0.048-0.031-0.103-0.014-0.153\n\tl0.945-2.735c0.077-0.222-0.005-0.476-0.195-0.603c-0.05-0.034-0.109-0.051-0.167-0.051c-0.061,0-0.121,0.018-0.173,0.055\n\tc-0.024,0.017-0.082,0.035-0.154,0.035c-0.073,0-0.13-0.019-0.155-0.037c-0.118-0.087-0.164-0.189-0.158-0.208l1.566-4.978\n\tc0.019-0.058,0.064-0.104,0.124-0.124l2-0.646c0.016-0.001,0.031-0.002,0.045-0.002c0.083,0,0.126,0.023,0.157,0.059\n\tc0.049,0.058,0.06,0.142,0.025,0.209l-0.584,1.153c-0.071,0.145-0.074,0.314-0.009,0.456c0.059,0.138,0.179,0.241,0.327,0.276\n\tl1.979,0.468c0.06,0.014,0.109,0.057,0.132,0.114c0.023,0.058,0.017,0.123-0.017,0.174l-1.717,2.631\n\tc-0.083,0.124-0.107,0.288-0.063,0.436l2.934,10.002c0.013,0.044,0.083,0.171,0.114,0.205l3.102,4.727\n\tc0.026,0.04,0.036,0.089,0.027,0.138l-0.995,6.118C37.375,47.622,37.26,48,37.198,48H32.008z M24.227,32.1\n\tc-0.022,0-0.044-0.004-0.067-0.013l-2.83-0.967C21.231,31.083,21,30.993,21,30.943v-0.168c0-0.025,0.204-0.106,0.302-0.164\n\tl1.755-0.969c0.023-0.014,0.106-0.027,0.149-0.027c0.043,0,0.107,0.014,0.139,0.037l1.943,1.4c0.05,0.036,0.084,0.093,0.084,0.153\n\tc0,0.061-0.026,0.118-0.075,0.154l-0.96,0.706C24.305,32.087,24.267,32.1,24.227,32.1z\"/>\n<path d=\"M86.77,92.156c-0.05,0-0.096-0.02-0.133-0.056l-2.92-2.835c-0.053-0.051-0.071-0.126-0.049-0.194l0.396-1.241\n\tc0.06-0.177,0.015-0.383-0.115-0.52l-3.703-3.858c-0.066-0.068-0.071-0.177-0.013-0.252l0.276-0.345l0.742-0.635\n\tc0.091-0.074,0.135-0.179,0.154-0.253l0.497-2.062c0.015-0.062,0.062-0.114,0.121-0.135l1.47-0.513l2.375-1.627\n\tc0.021-0.004,0.121-0.043,0.141-0.052l0.218-0.089l5.707-0.71l1.546-0.604c0,0.001,0.163,0.011,0.164,0.012\n\tc0.049,0.027,0.084,0.078,0.094,0.135l0.038,0.23c0.006,0.039,0.001,0.079-0.017,0.113l-0.202,0.421\n\tc-0.026,0.054-0.078,0.093-0.139,0.104l-5.219,0.951c-0.174,0.029-0.322,0.166-0.375,0.347c-0.055,0.172-0.011,0.369,0.117,0.507\n\tl0.722,0.753c0.043,0.045,0.062,0.109,0.047,0.17c-0.015,0.064-0.06,0.115-0.119,0.138l-0.979,0.362\n\tc-0.03,0.004-0.056,0.006-0.075,0.006c-0.046,0-0.069-0.009-0.091-0.021l-1.601-1.157C85.798,79.217,85.745,79,85.691,79\n\tc-0.008,0-0.016,0-0.023,0c-0.197,0-0.272,0.214-0.356,0.298c-0.106,0.061-0.193,0.353-0.172,0.546l0.532,5.464\n\tc0.009,0.123,0.069,0.274,0.168,0.362l2.92,2.565c0.065,0.058,0.083,0.159,0.042,0.238l-1.864,3.578\n\tc-0.027,0.052-0.078,0.089-0.136,0.098L86.77,92.156z\"/>\n<path d=\"M69.306,70.291c-0.033,0-0.082-0.009-0.126-0.049l-2.258-2.036c-0.036-0.032-0.079-0.056-0.125-0.067\n\tc0.017-0.031,0.027-0.066,0.032-0.103c0.075-0.626,0.165-0.91,0.23-1.118c0.043-0.133,0.075-0.24,0.093-0.366l0.101-1.412\n\tc0.007-0.078,0.033-0.188,0.049-0.219l1.901-2.475c0.049-0.062,0.105-0.094,0.129-0.096c0.019-0.001,0.04-0.005,0.062-0.012\n\tc0.028,0.005,0.06,0.017,0.085,0.04l2.687,2.472c0.034,0.027,0.059-0.026,0.1,0.056C72.317,65.008,72.421,65,72.534,65\n\tc0.006,0,0.012,0,0.019,0c0.119,0,0.224-0.014,0.264-0.127c0.037-0.104,0.077-0.096,0.111-0.112l1.313-0.771l0.098-0.019\n\tc0.123,0.035,0.165,0.084,0.182,0.14l0.226,0.776c0.021,0.071,0.12,0.173,0.183,0.212l0.164,0.066\n\tc0.05,0.019,0.089,0.058,0.11,0.106c0.021,0.047,0.021,0.103,0,0.147l-0.173,0.388c-0.03,0.069-0.1,0.115-0.173,0.115l-5.918-0.142\n\tc-0.137,0-0.262,0.059-0.349,0.162l-0.936,1.112c-0.159,0.185-0.163,0.462-0.008,0.657l1.809,2.27\n\tc0.061,0.078,0.053,0.188-0.021,0.257C69.4,70.272,69.354,70.291,69.306,70.291z M65.914,68.3h0.526l-0.04,0.05\n\tc-0.035,0.046-0.091,0.072-0.149,0.072L65.914,68.3z\"/>\n<path d=\"M72.647,65.515c-0.054-0.119-0.099-0.215-0.165-0.284l-2.726-3.009c0.003-0.003-0.021-0.082-0.031-0.119l-0.352-1.127\n\tl-0.115-0.608c0,0-0.055-0.219-0.06-0.232l-0.031-0.153l0.204-1.12c0.007-0.034,0.023-0.067,0.047-0.094l0.391-0.436l0.786-1.478\n\tc0.03-0.059,0.085-0.096,0.148-0.104l3.451-0.388c0.046-0.005,0.09-0.021,0.128-0.045l3.361-2.141c0.031-0.02,0.066-0.03,0.103-0.03\n\tc0,0,2.987,0.129,3.063,0.131c0.058,0.002,0.114,0.03,0.147,0.077l0.103,0.138c0.023,0.032,0.053,0.059,0.086,0.079l0.33,0.199\n\tl0.416,0.311c0.076,0.059,0.095,0.173,0.038,0.256l-1.677,2.447l-1.144,3.001c-0.021,0.054-0.062,0.095-0.116,0.113l-1.305,0.451\n\tc-0.043,0.015-0.082,0.039-0.114,0.071c-0.029,0.029-0.122,0.079-0.159,0.086L75.94,61.75c-0.039,0.006-0.075,0.02-0.108,0.039\n\tl-0.723,0.438l-0.121,0.083c-0.072,0.05-0.119,0.129-0.129,0.216l-0.03,0.326c-0.027,0.298-0.046,0.422-0.116,0.462l-1.916,1.956\n\tC72.74,65.313,72.696,65.401,72.647,65.515z\"/>\n<path d=\"M17.023,39.043c-0.05,0-0.097-0.02-0.132-0.054l-0.944-0.919c-0.063-0.062-0.076-0.159-0.03-0.235l2.36-3.934\n\tc0.074-0.123,0.05-0.28-0.056-0.376l-0.676-0.613c-0.042-0.038-0.065-0.091-0.062-0.146c0.002-0.057,0.029-0.109,0.073-0.144\n\tl1.974-1.537c0.034-0.026,0.074-0.04,0.117-0.04c0.047,0.035,0.054,0.121,0.054,0.189c0,0.155,0.118,0.3,0.272,0.314\n\tc0.239,0.022,0.373,0.043,0.445,0.059c0.04,0.083,0.104,0.153,0.182,0.18c0,0,0.256,0.08,0.284,0.092l2.793,1.015\n\tc0.096,0.035,0.151,0.136,0.125,0.23l-1.257,4.548c-0.019,0.066-0.072,0.119-0.14,0.134l-5.341,1.232L17.023,39.043z\"/>\n<path d=\"M67.035,93.828c-0.028,0-0.058-0.007-0.083-0.019l-4.886-2.334c-0.053-0.025-0.09-0.072-0.104-0.129\n\tc-0.013-0.058,0.001-0.117,0.038-0.163l0.596-0.743c0.032-0.04,0.08-0.066,0.131-0.07c0.002,0,5.114-0.443,5.22-0.452\n\tc0.034,0.001,0.087,0.025,0.124,0.068c0.039,0.046,0.054,0.108,0.038,0.168l-0.891,3.531c-0.014,0.056-0.051,0.101-0.103,0.125\n\tL67.035,93.828z M51.161,85.679c-0.027-0.008-0.054-0.021-0.075-0.039c-0.04-0.033-0.064-0.083-0.066-0.137l-0.164-4.188\n\tc-0.002-0.054,0.019-0.106,0.057-0.145c0.033-0.032,0.082-0.053,0.132-0.053c0.034,0.002,1.672,0.073,1.826,0.08\n\tC52.85,81.211,53,81.299,53,81.359v3.895c0,0.149-0.146,0.227-0.154,0.252L51.161,85.679z M70.169,85.654\n\tc-0.021-0.056-0.081-0.17-0.168-0.378l-0.75-1.945c-0.04-0.121-0.083-0.25-0.2-0.325l-6.539-3.932l-6.026-5.521\n\tc-0.027-0.024-0.049-0.063-0.057-0.103l-0.62-2.84c-0.028-0.125-0.098-0.232-0.197-0.306l-2.135-1.531l-0.291-0.402\n\tc-0.059-0.077-0.147-0.118-0.238-0.118c-0.053,0-0.105,0.014-0.153,0.042c-0.131,0.078-0.183,0.241-0.12,0.381l0.077,0.172\n\tl-3.208,1.435l-0.163-0.005c-0.052-0.026-0.088-0.072-0.1-0.129L49.142,69.5c-0.027-0.13-0.1-0.24-0.205-0.312l-0.493-0.344\n\tc-0.053-0.036-0.083-0.097-0.082-0.162l0.112-4.474c0.002-0.07,0.044-0.136,0.108-0.165l2.601-1.242\n\tc0.03-0.004,0.057-0.006,0.079-0.006c0.087,0,0.128,0.026,0.155,0.064l0.479,0.664c0.093,0.128,0.231,0.2,0.381,0.2\n\tc0.053,0,0.104-0.014,0.149-0.039l3.678-2.104c0.116-0.07,0.197-0.18,0.232-0.311c0.019-0.069,0.074-0.123,0.144-0.139\n\tc0,0,2.624-0.585,2.628-0.585c0.108,0,0.173,0.043,0.202,0.109c0.055,0.121,0.151,0.214,0.271,0.26l2.458,0.933\n\tc0.054,0.021,0.094,0.062,0.112,0.114s0.013,0.11-0.016,0.158c-0.079,0.135-0.093,0.298-0.039,0.446l0.399,1.11l0.148,0.514\n\tc0.014,0.05,0.008,0.105-0.02,0.148c-0.028,0.046-0.074,0.078-0.125,0.089l-2.58,0.519c-0.234,0.046-0.4,0.271-0.387,0.521\n\tl0.133,3.329c0.005,0.14,0.066,0.272,0.169,0.363l13.88,12.343c0.072,0.064,0.084,0.176,0.027,0.254\n\tc-0.036,0.049-0.092,0.077-0.153,0.077c-0.034,0-0.07-0.01-0.103-0.029l-1.319-0.795l-0.29-0.412\n\tc-0.058-0.083-0.15-0.128-0.245-0.128c-0.049,0-0.099,0.012-0.145,0.037c-0.134,0.073-0.191,0.236-0.133,0.377l0.113,0.273\n\tc-0.021,0.035-0.036,0.072-0.046,0.112l-1.078,3.969C70.298,85.404,70.226,85.565,70.169,85.654z\"/>\n<path d=\"M80.408,74.796c-0.062,0-0.12-0.03-0.155-0.08c-0.019-0.028-0.065-0.074-0.092-0.095l-0.532-0.415l-0.438-0.366\n\tc-0.027-0.024-0.049-0.057-0.059-0.092c-0.027-0.094,0.015-0.212,0.086-0.249l0.47-0.241c0.133-0.068,0.226-0.194,0.256-0.346\n\tl0.118-0.55c0.012-0.052,0.042-0.096,0.086-0.122c0.03-0.019,0.065-0.029,0.1-0.029l0.183,0.043\n\tc0.051,0.013,0.093,0.044,0.117,0.087l0.998,1.7c0.027,0.045,0.033,0.101,0.019,0.152c-0.016,0.049-0.051,0.091-0.098,0.112\n\tl-0.977,0.471L80.408,74.796z\"/>\n<path d=\"M53.877,60.213c-0.052,0-0.101-0.021-0.136-0.058l-0.134-0.137c-0.055-0.056-0.068-0.143-0.034-0.215l0.085-0.176\n\tc0.02-0.041,0.029-0.086,0.029-0.131V59.33c0-0.089,0.061-0.164,0.147-0.184c0.007,0,0.014-0.001,0.021-0.001\n\tc0.104,0,0.163,0.04,0.193,0.103l0.133,0.278l0.018,0.497c0,0.104-0.085,0.189-0.189,0.189H53.877z\"/>\n<path d=\"M81.136,34.118c-0.066-0.008-0.126-0.055-0.151-0.122c-0.044-0.121-0.132-0.217-0.245-0.27l-1.164-0.54\n\tc-0.057-0.026-0.097-0.08-0.107-0.144l-0.032-0.203l0.11-0.635c0.05-0.256-0.091-0.508-0.329-0.585l-2.794-0.887\n\tc-0.057-0.018-0.103-0.062-0.121-0.117l-0.51-1.467c-0.028-0.165,0.038-0.013,0.14-0.032L83.312,28c0.008,0,0.017,0,0.023,0\n\tc0.055,0,0.086-0.236,0.112-0.219l1.214,0.656c0.067,0.043,0.101,0.059,0.084,0.136l-0.342,2.139c-0.017,0.1,0.02,0.186,0.094,0.253\n\tc0.109,0.093,0.191,0.153,0.204,0.186L84.7,32.525c-0.008,0.016-0.084,0.1-0.217,0.167l-2.893,1.439\n\tc-0.018,0.009-0.066,0.02-0.107,0.021C81.418,34.148,81.136,34.118,81.136,34.118z\"/>\n<path d=\"M47.343,51.88c-0.037,0-0.073-0.011-0.104-0.031c-0.049-0.032-0.106-0.048-0.163-0.048c-0.057,0-0.114,0.016-0.164,0.048\n\tc-0.03,0.021-0.067,0.031-0.103,0.031l-0.638-0.284C46.15,51.573,46,51.486,46,51.429v-0.155l-0.098-0.844l0.053-0.107l0.404-0.934\n\tc0.022-0.053,0.079-0.163,0.13-0.176L47.037,49c0.013,0,0.026,0,0.04,0c0.132,0,0.31,0.099,0.359,0.121\n\tc0.008,0.009,0.187,0.164,0.229,0.197c-0.056,0.035-0.102,0.085-0.139,0.125l-0.133,0.106c-0.101,0.072-0.146,0.203-0.115,0.323\n\tl0.389,1.5c0.006,0.022,0.034,0.091,0.044,0.111l-0.01,0.206c-0.003,0.033-0.084,0.129-0.203,0.177\n\tC47.481,51.87,47.39,51.88,47.343,51.88z\"/>\n<path d=\"M75.79,27.866c-0.048,0-0.096-0.02-0.131-0.053c-0.044-0.042-0.064-0.104-0.057-0.166l0.486-3.346\n\tc0.009-0.057,0.045-0.109,0.097-0.138l0.166-0.009l2.817,1.009C79.207,25.178,79.247,25,79.286,25c0.009,0,0.017,0,0.025,0\n\tc0.098,0,0.18,0.178,0.248,0.145c0,0,0.02,0.083,0.021,0.082c0.115-0.069,0.198-0.139,0.229-0.278l0.666-2.89\n\tc0.011-0.107,0.041-0.159,0.08-0.191l0.663-0.532c0.034-0.027,0.076-0.039,0.119-0.039l0.926,0.312l2.719,0.566\n\tc0.054,0.011,0.101,0.046,0.127,0.094l0.467,0.623c0.017,0.035,0.222,0.085,0.265,0.126C85.846,23.021,86,23.023,86,23.025v0.156\n\tc0,0.108-0.094,0.203-0.006,0.256c-0.002,0.06-0.062,0.121-0.035,0.169l1.193,1.98c0.044,0.067-0.006,0.165-0.059,0.229\n\tl-0.671,0.952C86.385,26.816,86.306,27,86.25,27h-0.237c-0.118,0-0.221-0.082-0.27,0.018c-0.031,0.032-0.071-0.002-0.073,0\n\tl-0.327,0.345c-0.037,0.042-0.089,0.047-0.147,0.047c-0.034,0-0.067-0.02-0.098-0.039l-1.371-0.858\n\tc-0.047-0.029-0.103-0.047-0.158-0.047l-0.094-0.009L75.79,27.866z\"/>\n<path d=\"M48.676,71.188c-0.076,0-0.145-0.046-0.175-0.117c-0.029-0.069-0.014-0.15,0.04-0.207l0.132-0.137\n\tc0.035-0.035,0.084-0.057,0.136-0.057C48.952,70.713,49,70.783,49,70.86v0.138c0,0.104-0.085,0.19-0.19,0.19H48.676z\"/>\n<path d=\"M91.603,52.731c-0.048-0.045-0.068-0.11-0.056-0.174c0.012-0.062,0.056-0.114,0.115-0.139l1.038-0.421v1.796L91.603,52.731z\n\t\"/>\n<path d=\"M81.758,78.792c-0.06,0-0.113-0.026-0.147-0.072l-1.186-1.556c-0.029-0.039-0.043-0.089-0.037-0.137l0.073-0.604\n\tc0.005-0.04,0.021-0.075,0.049-0.104l0.338-0.566c0.019-0.033,0.048-0.061,0.083-0.077l1.413-0.679\n\tc0.039-0.002,0.153-0.029,0.188-0.046l0.344,0.084L83.767,75c0.013,0,0.025,0,0.037,0c0.079,0,0.12-0.223,0.151-0.189l0.256,0.143\n\tl1.173,0.919c0.057,0.046,0.081,0.089,0.064,0.157l0.006,0.641c0,0.056-0.03,0.105-0.083,0.142l-2.188,1.497l-1.364,0.476\n\tL81.758,78.792z\"/>\n<path d=\"M76.753,75.188c-0.057,0-0.111-0.025-0.148-0.07l-0.229-0.281c-0.03-0.037-0.067-0.065-0.11-0.085l-0.739-0.329\n\tl-0.139-0.072c-0.083-0.073-0.109-0.13-0.112-0.162l-0.082-0.879c-0.003-0.027,0.001-0.055,0.01-0.08l0.373,0.093\n\tc0.024,0.006,0.049,0.009,0.072,0.009c0.119,0,0.23-0.071,0.277-0.187c0.057-0.138,0.003-0.296-0.125-0.372l-0.163-0.096\n\tl0.544-0.754C76.21,71.873,76.261,72,76.319,72c0.001,0,0.002,0,0.003,0c0.072,0,0.116-0.152,0.15-0.121l0.692,0.56l0.368,0.164\n\tl0.478,0.207c0.092,0.043,0.133,0.14,0.094,0.232c-0.036,0.164-0.128,0.244-0.217,0.244l-0.284-0.01\n\tc-0.231,0-0.427,0.181-0.464,0.422l-0.2,1.328c-0.011,0.075-0.064,0.135-0.137,0.155L76.753,75.188z\"/>\n<path d=\"M46.496,46.525c-0.054,0-0.105-0.023-0.142-0.063l-1.732-1.926c-0.071-0.08-0.171-0.135-0.28-0.153l-0.544-0.081\n\tc-0.062-0.009-0.116-0.049-0.144-0.106c-0.026-0.056-0.023-0.123,0.009-0.178l2.201-3.751c0.027-0.046,0.072,0.098,0.123,0.087\n\tL48.449,40c0.007,0,0.014,0,0.021,0c0.086,0,0.138-0.149,0.17-0.105c0.044,0.059,0.051,0.051,0.016,0.116l-1.995,3.697\n\tc-0.074,0.14-0.082,0.283-0.021,0.43l0.315,0.756c0.014,0.035,0.018,0.067,0.01,0.104l-0.284,1.378\n\tc-0.014,0.069-0.067,0.125-0.136,0.143L46.496,46.525z\"/>\n<path d=\"M50.416,22.134c-0.042,0-0.083-0.014-0.115-0.039l-1.732-1.325c-0.048-0.037-0.076-0.095-0.075-0.155l0.249-10.938\n\tc0.002-0.085,0.062-0.159,0.144-0.181l1.676-0.423c0.033,0.011,0.086,0.017,0.144,0.017c0.099,0,0.211-0.017,0.26-0.05l4.146-3.014\n\tC55.19,6.095,55.281,6,55.401,6H57.5C57.665,6,58,6.167,58,6.001c0-0.066,0-0.177,0-0.177c0-0.042,0-0.12,0.03-0.138\n\tc-0.019,0.011,0.022,0.011,0.047,0.022c0.041,0.052,0.067,0.084,0.132,0.1c0.066,0.016,0.133,0.055,0.133,0.148\n\tc0,0.039-0.017,0.089-0.092,0.14c-0.089,0.061-0.142,0.164-0.133,0.271l0.353,4.531c0.013,0.131,0.042,0.3,0.071,0.405\n\tc0.02,0.071,0.063,0.132,0.126,0.172l0.719,0.462c0.068,0.043,0.101,0.122,0.082,0.2l-1.503,6.559\n\tc-0.014,0.057-0.055,0.106-0.109,0.131c-0.046,0.021-0.087,0.054-0.117,0.095c-0.064,0.087-0.111,0.14-0.173,0.169l-7.076,3.026\n\tL50.416,22.134z\"/>\n<path d=\"M81.464,50.892c-0.044,0-0.075-0.006-0.084-0.009l-1.859-0.772c-0.037-0.016-0.076-0.023-0.115-0.023\n\tc-0.016,0-0.03,0.001-0.046,0.003l-2.619,0.404l-2.867-0.005c-0.041,0-0.083-0.016-0.117-0.043c-0.11-0.074-4.025-2.66-4.025-2.66\n\tc-0.037-0.024-0.081-0.041-0.125-0.047c0,0-0.155-0.021-0.17-0.021c-0.027,0-0.056,0.004-0.082,0.011\n\tc-0.129,0.037-0.238,0.13-0.301,0.257l-0.214,0.447c-0.023,0.049-0.066,0.085-0.119,0.101c-0.021,0.001-0.038,0.002-0.053,0.002\n\tc-0.051,0-0.075-0.009-0.097-0.022l-3.156-1.925c-0.044-0.027-0.075-0.072-0.086-0.123l-0.545-2.619l0.213-0.748\n\tc0.029-0.092,0.033-0.19,0.01-0.283l-0.927-4.191c-0.024-0.11-0.108-0.197-0.218-0.226c-0.131-0.034-0.153-0.109-0.172-0.169\n\tC63.661,38.145,63.606,38,63.565,38c-0.001,0-0.002,0-0.002,0c-0.008,0-0.019-0.022-0.034-0.048\n\tc-0.032-0.054-0.225-0.092-0.271-0.149C63.223,37.758,63,37.691,63,37.659v-0.555c0-0.105,0.277-0.18,0.578-0.25l0.189-0.017\n\tc0.037-0.005,0.111-0.017,0.144-0.034c0.086-0.045,3.669-1.892,3.669-1.892l2.519-1.12c0.004,0,0.159-0.005,0.159-0.005l2.739,1.015\n\tc0.008,0,0.17,0.022,0.177,0.022c0.084,0,0.208-0.01,0.317-0.099c0.034-0.029,0.074-0.044,0.115-0.047l4.559-0.264l1.101-0.142\n\tl0.155-0.028l0.687,0.291c0.046,0.021,0.08,0.058,0.097,0.104l0.167,0.436l0.396,1.099l0.822,2.696\n\tc0.018,0.056,0.008,0.117-0.025,0.164l-0.87,1.244c-0.112,0.162-0.123,0.38-0.026,0.555l1.066,1.945l0.094,0.332\n\tc0.016,0.058,0.108,0.186,0.153,0.225c0.046,0.04,0.069,0.096,0.066,0.154l-0.353,7.22c-0.004,0.088-0.067,0.16-0.154,0.176\n\tL81.464,50.892z\"/>\n<path d=\"M7.013,86.845c-0.055-0.007-0.107-0.039-0.138-0.087c-0.031-0.047-0.039-0.107-0.022-0.161l0.938-2.933\n\tc0.011-0.035,0.016-0.072,0.014-0.109L7.56,79.313l2.708-7.437c0.089-0.118,0.182-0.162,0.244-0.162l3.05,0.74\n\tc0.096,0.024,0.158,0.116,0.143,0.214l-0.904,5.764c-0.011,0.067-0.056,0.124-0.12,0.147l-1.1,0.416\n\tc-0.161,0.063-0.273,0.203-0.306,0.375l-1.486,7.608c-0.018,0.089-0.096,0.153-0.186,0.153L7.013,86.845z\"/>\n<path d=\"M84.464,66.985c-0.023-0.005-0.046-0.014-0.066-0.026c-0.049-0.031-0.188-0.077-0.245-0.077l-2.09-1.007l-1.568-1.751\n\tl-1.717-1.789c-0.045-0.046-0.063-0.114-0.049-0.178c0.015-0.061,0.062-0.111,0.121-0.132l0.777-0.271\n\tc0.128-0.042,0.238-0.151,0.292-0.29l1.169-3.117l1.878-2.766c0.032-0.047,0.081-0.077,0.136-0.082c0.001,0,2.256-0.235,2.348-0.243\n\tl1.41,0.25c0.017,0.003,0.034,0.004,0.052,0.004c0.07,0,0.14-0.024,0.194-0.071l2.736-2.331c0.035-0.029,0.078-0.046,0.123-0.046\n\tc0.066,0.005,0.113,0.03,0.146,0.068l1.869,2.38c-0.072,0.082,0.02,0.177,0.02,0.3v9.61c0,0.067-0.127,0.133-0.086,0.186\n\tl0.132,0.264c-0.004,0.036-0.049,0.07-0.057,0.085L84.464,66.985z\"/>\n<path d=\"M74.672,33.604c-0.066-0.002-0.127-0.038-0.159-0.094c-0.035-0.061-0.033-0.14,0.006-0.199l0.312-0.479\n\tc0.032-0.047,0.087-0.08,0.146-0.084c0.039-0.003,0.077-0.014,0.112-0.032l1.132-0.574c0.092-0.049,0.162-0.12,0.205-0.204\n\tc0.028-0.05,0.092-0.088,0.161-0.088l1.775,0.554c0.048,0.015,0.086,0.048,0.108,0.089l-0.312,0.149\n\tc-0.134,0.064-0.201,0.218-0.156,0.36c0.039,0.127,0.156,0.21,0.286,0.21c0.016,0,0.031-0.001,0.048-0.003l0.186-0.03\n\tc0.002,0.043-0.012,0.087-0.038,0.123c-0.03,0.04-0.076,0.066-0.128,0.073l-0.27,0.034C78.074,33.408,74.864,33.594,74.672,33.604z\"\n\t/>\n<path d=\"M82.642,73.809c-0.067,0-0.131-0.036-0.164-0.094l-1.26-2.149c-0.062-0.108-0.164-0.189-0.287-0.224l-1.072-0.278\n\tc-0.024-0.007-0.05-0.01-0.075-0.01c-0.023,0-0.048,0.003-0.07,0.008c-0.136,0.024-0.2,0.037-0.267,0.104\n\tc-0.062,0.031-0.141,0.146-0.168,0.285l-0.111,0.522c-0.012,0.056-0.05,0.105-0.101,0.13l-0.167,0.002l-0.958-0.455l-0.174-0.091\n\tl-0.818-0.747c-0.034-0.032-0.055-0.073-0.061-0.12c-0.016-0.105-0.541-3.119-0.541-3.119c-0.316-0.999-0.419-1.323-0.428-1.381\n\tl0.394-0.957c0.101-0.234,0.018-0.511-0.192-0.644l-0.431-0.268c-0.042-0.026-0.072-0.068-0.084-0.118l-0.199-0.833\n\tc-0.019-0.076,0.013-0.157,0.077-0.201l0.122-0.082l0.536-0.336c0,0,1.344-0.23,1.346-0.23c0.078,0,0.127,0.021,0.16,0.057\n\tl2.162,2.251l1.588,1.79c0.025,0.028,0.057,0.052,0.091,0.069l1.979,0.985c0.057,0.028,0.097,0.082,0.105,0.143l0.56,3.733\n\tc0.013,0.079-0.027,0.157-0.099,0.194l-0.097,0.051c-0.175,0.091-0.28,0.283-0.269,0.489l0.082,1.031\n\tc0.007,0.088-0.048,0.169-0.133,0.195l-0.921,0.289L82.642,73.809z\"/>\n<path d=\"M70.736,55.729c-0.074,0-0.139-0.041-0.17-0.107l-0.348-0.725c-0.025-0.052-0.025-0.112,0-0.163l0.085-0.178\n\tc0.037-0.139,0.101-0.227,0.132-0.244l1.398-0.786c0.114-0.099,0.212-0.144,0.268-0.144c0.026,0.004,0.396,0.048,0.407,0.048\n\tc0.032,0,0.064-0.005,0.096-0.016l0.851-0.436C73.534,53.072,73.63,53,73.772,53h2.943c0.049,0,0.098,0.139,0.141,0.115l2.165-1.185\n\tC79.1,51.896,79,51.896,79,51.841c0-0.002,0-0.003,0-0.003s0.139,0.026,0.07,0.026c0.047,0,0.205-0.021,0.259-0.05l0.839,0.127\n\tc0.015,0.002,0.056,0.003,0.071,0.003c0.027,0,0.065-0.004,0.092-0.011c0.017-0.005,0.041-0.008,0.058-0.008\n\tc0.051,0,0.103,0.022,0.14,0.053c0,0.001,0.105,0.084,0.106,0.085c0.05,0.092,0.052,0.147,0.046,0.165\n\tc-0.011,0.027-0.032,0.057-0.061,0.08c-0.039,0.031-0.068,0.072-0.087,0.118l-0.207,0.507c-0.014,0.033-0.021,0.068-0.022,0.104\n\tc-0.021,0.14-0.097,0.198-0.184,0.198c0,0-2.544-0.106-2.547-0.106c-0.058,0-0.113,0.017-0.161,0.047l-3.392,2.165L70.736,55.729z\"\n\t/>\n<path d=\"M63.921,67c-0.007,0-0.145-0.512-0.186-0.727l-0.338-2.05l-0.235-1.1c-0.016-0.062-0.005-0.177,0.014-0.211l0.14-0.302\n\tc0.07-0.054,0.121-0.153,0.134-0.247l0.002,0.014c0.04-0.079,0.132-0.16,0.17-0.169l2.864-0.535l1.35-0.299\n\tc0.089-0.021,0.174-0.072,0.249-0.151l0.189-0.203c0.036-0.039,0.087-0.062,0.14-0.062c0.08,0.009,0.135,0.044,0.164,0.096\n\tl0.057,0.097c0.037,0.066,0.028,0.154-0.024,0.215l-2.1,2.429c-0.032,0.037-0.055,0.082-0.066,0.13\n\tc-0.034,0.15-0.074,0.512-0.087,0.64l-0.019,0.163l-0.049,1.524C66.28,66.424,66.149,67,66.061,67H63.921z\"/>\n<path d=\"M60.879,27.765c-0.048-0.008-0.091-0.035-0.12-0.074l-0.695-0.927l-1.724-6.172c-0.025-0.092,0.021-0.189,0.11-0.226\n\tc0.153-0.065,0.256-0.185,0.291-0.338l1.733-7.751c0.033-0.146,0.004-0.256-0.105-0.389l-0.916-0.95\n\tc-0.029-0.03-0.048-0.07-0.051-0.112l-0.369-4.492c-0.003-0.032,0.003-0.064,0.016-0.093l0.249-0.226\n\tC59.339,6.079,59.447,6,59.592,6c0,0,8.8,0,8.807,0l-1.947,1.874c-0.067,0.06-0.104,0.223-0.101,0.312l0.251,5.74\n\tc0.007,0.185,0.114,0.311,0.149,0.345l2.108,2.098c0.048,0.047,0.066,0.115,0.051,0.179c-0.016,0.064-0.063,0.117-0.128,0.137\n\tl-3.309,1.044c-0.119,0.038-0.22,0.123-0.282,0.24c-0.063,0.127-0.073,0.269-0.033,0.397l0.764,2.521l-0.35,7.492\n\tc-0.003,0.055-0.028,0.105-0.07,0.138c-0.034,0.028-0.076,0.043-0.118,0.043L60.879,27.765z\"/>\n<path d=\"M82.848,54.51c-0.039,0-0.077-0.013-0.109-0.036l-0.731-0.524l-0.281-0.126c-0.428-0.41-0.497-0.477-0.526-0.513\n\tc-0.032-0.05-0.042-0.106-0.027-0.159c0.015-0.054,0.05-0.097,0.101-0.121l0.559-0.273c0.115-0.093,0.153-0.123,0.188-0.151\n\tc0.108-0.088,0.142-0.24,0.079-0.366l-0.07-0.142C82,52.043,82,51.978,82.028,51.922c0.026-0.052,0.079-0.089,0.139-0.098\n\tl0.247-0.038c0.137-0.021,0.242-0.134,0.253-0.272l0.183-8.11c0.002-0.078,0.054-0.149,0.128-0.175l5.721-2.003\n\tc0.036-0.007,2.278-0.173,3.183-0.243C91.861,41.03,92,41.083,92,41.141v9.095c0,0.08-0.119,0.156-0.062,0.212\n\ts0.059,0.087,0.138,0.087l0.541-0.003c0.117,0.017,0.249,0.134,0.257,0.184c0,0.031-0.013,0.187-0.149,0.192\n\tc-0.035,0.001-0.075,0.009-0.107,0.022l-2.412,0.984c-0.054,0.021-0.101,0.058-0.134,0.105c-0.015,0.02-0.075,0.083-0.096,0.101\n\tl-2.964,2.321c-0.034,0.025-0.072,0.04-0.112,0.04l-1.352-0.232c-0.183,0.001-2.265,0.216-2.681,0.259L82.848,54.51z\"/>\n<path d=\"M60.544,77.578c-0.104,0-0.189-0.086-0.189-0.19v-0.137c0-0.104,0.085-0.19,0.189-0.19c0.106,0,0.19,0.084,0.19,0.19v0.137\n\tC60.734,77.494,60.65,77.578,60.544,77.578z\"/>\n</svg>\n"};
dw.__visMeta['pie-chart'] = {"axes": {"labels": {"accepts": ["text", "date"]}, "slices": {"multiple": true, "accepts": ["number"]}}, "dimensions": 1, "icon": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!-- Generator: Adobe Illustrator 16.2.1, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1 Basic//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11-basic.dtd\">\n<svg version=\"1.1\" baseProfile=\"basic\" id=\"Ebene_1\"\n\t xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" width=\"100px\" height=\"100px\"\n\t viewBox=\"0 0 100 100\" xml:space=\"preserve\">\n<path d=\"M50.751,48.738l0.075-41.294c6.559,0.191,12.831,1.83,18.648,4.873C89.948,23.025,98.29,47.639,88.62,68.544L50.751,48.738z\n\t\"/>\n<path d=\"M49.477,93.607c-6.895-0.001-13.791-1.702-19.942-4.92C19.333,83.354,11.821,74.366,8.381,63.382S5.984,40.73,11.319,30.531\n\tC18.458,16.883,32.348,8.082,47.657,7.466l0.092,42.482l0.072,0.258l0.268,0.442l0.196,0.184l39.004,20.4\n\tC79.724,85.047,65.283,93.607,49.48,93.607H49.477z\"/>\n</svg>\n", "author": {"name": "gka", "email": "gka@vis4.net"}, "locale": {"cannotShowNegativeValues": "Pie charts are intended to show part-of-whole relations, and thus they <b>cannot be used to display negative numbers</b>. Please consider using a different chart type instead (eg. a bar chart).", "noMoreThanFiveSlices": "Your data contains <b>more values than can be shown in a pie chart</b>, so we grouped %count slices into the slice named <i>'others'</i>.<p>Why not use a bar chart to allow better comparison of values?</p>", "other": "other"}, "title": "Pie chart", "id": "pie-chart", "libraries": [], "options": {"base-color": {"type": "base-color", "label": "Base color"}}, "extends": "raphael-chart", "version": "1.5.0", "__static_path": "/static/plugins/visualization-pie-chart/", "order": 50, "color-by": "row"};
dw.__visMeta['donut-chart'] = {"axes": {"labels": {"accepts": ["text", "date"]}, "slices": {"multiple": true, "accepts": ["number"]}}, "dimensions": 1, "author": {"name": "gka", "email": "gka@vis4.net"}, "title": "Donut chart", "id": "donut-chart", "version": "1.5.0", "extends": "pie-chart", "__static_path": "/static/plugins/visualization-pie-chart/", "options": {"show-total": {"default": true, "type": "checkbox", "label": "Show total value in center"}, "custom-total": {"default": false, "depends-on": {"show-total": true, "chart.max_row_num": 1}, "type": "checkbox", "label": "Use custom total value instead of sum"}, "custom-total-value": {"depends-on": {"show-total": true, "custom-total": true}, "type": "text", "label": "Custom total value"}}, "order": 60, "icon": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!-- Generator: Adobe Illustrator 16.2.1, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1 Basic//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11-basic.dtd\">\n<svg version=\"1.1\" baseProfile=\"basic\" id=\"Ebene_1\"\n\t xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" width=\"100px\" height=\"100px\"\n\t viewBox=\"0 0 100 100\" xml:space=\"preserve\">\n<path d=\"M70.475,12.317c-5.817-3.043-12.09-4.682-18.648-4.873l-0.053,29.288c6.397,0.638,11.394,6.037,11.394,12.603\n\tc0,1.725-0.348,3.368-0.972,4.866L89.62,68.544C99.29,47.639,90.948,23.025,70.475,12.317z\"/>\n<path d=\"M60.71,56.809c-2.305,3.144-6.014,5.192-10.21,5.192c-6.996,0-12.667-5.671-12.667-12.667c0-6.39,4.603-11.64,10.753-12.507\n\tl0.07-29.36c-15.309,0.616-29.198,9.417-36.337,23.064C6.984,40.73,5.94,52.397,9.381,63.382s10.953,19.972,21.154,25.306\n\tc6.151,3.218,13.047,4.919,19.942,4.92h0.004c15.803,0,30.243-8.561,37.809-22.374L60.71,56.809z\"/>\n</svg>\n"};
dw.__visMeta['election-donut-chart'] = {"__static_path": "/static/plugins/visualization-election-donut/", "dimensions": 1, "title": "Election Donut", "axes": {"labels": {"accepts": ["text", "date"]}, "slices": {"multiple": true, "accepts": ["number"]}}, "id": "election-donut-chart", "version": "1.5.0", "extends": "donut-chart", "options": {"sort-values": {"default": true, "type": "checkbox", "label": "Sort by size"}, "base-color": {"type": "base-color", "label": "Base color"}}, "order": 60, "icon": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!-- Generator: Adobe Illustrator 16.2.1, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1 Basic//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11-basic.dtd\">\n<svg version=\"1.1\" baseProfile=\"basic\" id=\"Ebene_1\"\n\t xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" width=\"100px\" height=\"100px\"\n\t viewBox=\"0 0 100 100\" xml:space=\"preserve\">\n<path d=\"M65.931,50.589C62.882,45.303,58,41.84,51,41.431V16.939c7,0.146,13.475,1.806,19.456,4.935\n\tc7.537,3.942,13.689,9.907,17.82,17.27L65.931,50.589z\"/>\n<path d=\"M66.916,67.427c1.135-2.439,1.709-5.028,1.709-7.704c0-2.534-0.521-5.002-1.553-7.344l22.386-11.466\n\tc6.031,12.013,6.156,26.303,0.337,38.436L66.916,67.427z\"/>\n<path d=\"M89.585,80.931\"/>\n<path d=\"M10.885,78.691C5.321,66.56,5.562,52.859,11.552,40.944l21.889,11.493c-1.013,2.324-1.526,4.773-1.526,7.286\n\tc0,2.664,0.555,5.225,1.651,7.619L10.885,78.691z\"/>\n<path d=\"M12.253,39.185C19.766,25.786,34,17.309,49,16.937v24.458c-6,0.265-11.922,3.761-15.054,9.244L12.253,39.185z\"/>\n</svg>\n"};
dw.__visMeta['grouped-column-chart'] = {"__static_path": "/static/plugins/visualization-column-charts/", "dimensions": 2, "title": "Grouped Column Chart", "axes": {"labels": {"accepts": ["text", "date"]}, "columns": {"multiple": true, "accepts": ["number"]}}, "order": 10, "libraries": [], "version": "1.5.0", "extends": "raphael-chart", "icon": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!-- Generator: Adobe Illustrator 16.2.1, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1 Basic//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11-basic.dtd\">\n<svg version=\"1.1\" baseProfile=\"basic\" id=\"Ebene_1\"\n\t xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" width=\"100px\" height=\"100px\"\n\t viewBox=\"0 0 100 100\" xml:space=\"preserve\">\n<rect x=\"22\" y=\"52\" width=\"11\" height=\"39\"/>\n<rect x=\"10\" y=\"47\" width=\"10\" height=\"44\"/>\n<rect x=\"52\" y=\"9.5\" width=\"11\" height=\"81.5\"/>\n<rect x=\"40\" y=\"28.667\" width=\"10\" height=\"62.333\"/>\n<rect x=\"82\" y=\"47\" width=\"10.667\" height=\"44\"/>\n<rect x=\"69\" y=\"36\" width=\"11\" height=\"55\"/>\n</svg>\n", "options": {"sort-values": {"type": "checkbox", "label": "Automatically sort bars"}, "reverse-order": {"type": "checkbox", "label": "Reverse order"}, "negative-color": {"depends-on": {"chart.min_value[columns]": "<0"}, "type": "checkbox", "label": "Use different color for negative values"}, "base-color": {"type": "base-color", "label": "Base color"}}, "id": "grouped-column-chart", "color-by": "row"};
dw.__visMeta['stacked-column-chart'] = {"__static_path": "/static/plugins/visualization-column-charts/", "dimensions": 2, "title": "Stacked Column Chart", "locale": {"cannotShowNegativeValues": "Negative values, as contained in your dataset, cannot be stacked on top of each other in a stacked column chart. Please consider using a different chart type instead (eg. a grouped column chart).", "stack percentages": "stack percentages"}, "axes": {"labels": {"accepts": ["text", "date"]}, "columns": {"multiple": true, "accepts": ["number"]}}, "order": 11, "version": "1.5.0", "extends": "grouped-column-chart", "icon": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!-- Generator: Adobe Illustrator 16.2.1, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1 Basic//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11-basic.dtd\">\n<svg version=\"1.1\" baseProfile=\"basic\" id=\"Ebene_1\"\n\t xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" width=\"100px\" height=\"100px\"\n\t viewBox=\"0 0 100 100\" xml:space=\"preserve\">\n<rect x=\"11\" y=\"54.958\" width=\"22.941\" height=\"35.042\"/>\n<rect x=\"11\" y=\"22.105\" width=\"22.941\" height=\"30.662\"/>\n<rect x=\"38.529\" y=\"60.433\" width=\"22.941\" height=\"29.567\"/>\n<rect x=\"38.529\" y=\"12.25\" width=\"22.941\" height=\"45.993\"/>\n<rect x=\"66.059\" y=\"54.958\" width=\"22.941\" height=\"35.042\"/>\n<rect x=\"66.059\" y=\"30.866\" width=\"22.941\" height=\"21.901\"/>\n</svg>\n", "options": {"normalize": {"default": false, "type": "checkbox", "label": "Stack percentages"}, "normalize-user": {"depends-on": {"normalize": true}, "type": "checkbox", "label": "Let user switch mode"}, "sort-values": {"type": "checkbox", "label": "Automatically sort bars"}, "reverse-order": {"type": "checkbox", "label": "Reverse order"}, "negative-color": {"type": "checkbox", "label": "Use different color for negative values"}, "base-color": {"type": "base-color", "label": "Base color"}}, "id": "stacked-column-chart", "color-by": "row"};
