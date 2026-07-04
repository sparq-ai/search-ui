// Deterministic dataset for e2e fixtures (classic script — runs before defer).
(function () {
  var brands = ['Nike', 'Adidas', 'Asics'];
  var categories = ['Road', 'Trail'];
  var data = [];
  var id = 1;
  for (var b = 0; b < brands.length; b++) {
    for (var i = 0; i < 16; i++) {
      data.push({
        id: id,
        name: brands[b] + ' Model ' + (100 + i),
        brand: brands[b],
        category: categories[i % 2],
        price: 50 + i * 10 + b * 5,
        url: '/products/' + id,
      });
      id++;
    }
  }
  window.__SPARQ_MOCK__ = { data: data, delayMs: window.__SPARQ_MOCK_DELAY__ || 0 };
})();
