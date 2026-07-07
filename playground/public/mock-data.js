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
      var swatchColors = ['Red', 'Blue', 'Black', 'Storm', 'Multi', 'Clear'];
      var gender = ['Men', 'Women', 'Kids'][id % 3];
      // Hierarchical taxonomy: each item carries its full ancestor chain.
      var taxonomy = [gender, gender + ' >>> ' + category, gender + ' >>> ' + category + ' >>> ' + brands[b]];
      data.push({
        taxonomy: taxonomy,
        id: id,
        name: brands[b] + ' ' + models[m] + ' ' + (100 + ((b * 7 + m * 13) % 900)),
        brand: brands[b],
        category: category,
        gender: gender,
        color: swatchColors[(b * 3 + m) % swatchColors.length],
        availability: id % 5 === 0 ? 'out of stock' : 'in stock',
        price: 60 + ((b * 31 + m * 17) % 140),
        rating: 1 + ((b + m) % 5),
        url: '/products/' + id,
      });
      id++;
    }
  }
  window.__SPARQ_MOCK__ = {
    data: data,
    // Per-collection datasets: federated autocomplete sections query these by
    // collection id; 'products' keeps the classic pages working.
    collections: {
      products: data,
      POPULAR: [
        { query: 'nike runner' }, { query: 'trail shoes' }, { query: 'adidas pulse' },
        { query: 'brooks dash' }, { query: 'asics storm' },
      ],
      CATEGORIES: [
        { title: 'Road running', url: '#road' },
        { title: 'Trail running', url: '#trail' },
        { title: 'Track spikes', url: '#track' },
        { title: 'Casual sneakers', url: '#casual' },
      ],
      PAGES: [
        { title: 'Shipping & returns', url: '#shipping' },
        { title: 'Size guide', url: '#sizes' },
        { title: 'About us', url: '#about' },
      ],
    },
    delayMs: 120,
    suggestions: [
      'nike runner', 'nike glide', 'adidas pulse', 'asics storm',
      'puma flow', 'new balance peak', 'brooks dash', 'trail shoes', 'road shoes',
    ],
  };
})();
