// Plain classic script (no module) so it runs before the deferred library
// script and works without any build step — sets the mock dataset consumed
// by api-host="mock:" providers.
(function () {
  var brands = ['Nike', 'Adidas', 'Asics', 'Puma', 'New Balance', 'Brooks'];
  var categories = ['Road', 'Trail', 'Track', 'Casual'];
  var models = ['Runner', 'Glide', 'Pulse', 'Storm', 'Flow', 'Peak', 'Dash', 'Bolt'];
  var data = [];
  var id = 1;
  for (var b = 0; b < brands.length; b++) {
    for (var m = 0; m < models.length; m++) {
      var category = categories[(b + m) % categories.length];
      data.push({
        id: id,
        name: brands[b] + ' ' + models[m] + ' ' + (100 + ((b * 7 + m * 13) % 900)),
        brand: brands[b],
        category: category,
        price: 60 + ((b * 31 + m * 17) % 140),
        rating: 3 + ((b + m) % 3),
        url: '/products/' + id,
      });
      id++;
    }
  }
  window.__SPARQ_MOCK__ = {
    data: data,
    delayMs: 120,
    suggestions: [
      'nike runner', 'nike glide', 'adidas pulse', 'asics storm',
      'puma flow', 'new balance peak', 'brooks dash', 'trail shoes', 'road shoes',
    ],
  };
})();
