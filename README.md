API Example:

```javascript
dw.visualize({
    type: 'line-chart', // the chart type
    theme: 'default', // the theme id
    container: $('#avg-time-on-site'), // a jQuery selector where the chart should be rendered
    // this is how you would load a CSV data source
    datasource: dw.datasource.delimited({ url: 'datasets/avg_time_on_site.csv' }),
    // options provided by the chart type
    // check http://datawrapper.de/api/visualizations for complete reference
    options: { 'line-mode': 'curved', 'fill-below': true }
});
```

See example.html for a full running demo.