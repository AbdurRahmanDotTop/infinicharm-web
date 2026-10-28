const searchInput = document.querySelector('#product-search');
const categoryFilter = document.querySelector('#category-filter');
const cards = Array.from(document.querySelectorAll('[data-product-card]'));
const visibleCount = document.querySelector('[data-visible-count]');
const emptySearch = document.querySelector('[data-empty-search]');
const resetFilters = document.querySelector('[data-reset-filters]');

function applyProductFilters() {
  if (!cards.length) return;
  const query = searchInput instanceof HTMLInputElement ? searchInput.value.trim().toLowerCase() : '';
  const category = categoryFilter instanceof HTMLSelectElement ? categoryFilter.value : 'All';
  let visible = 0;
  cards.forEach((card) => {
    const name = card.getAttribute('data-name') || '';
    const itemCategory = card.getAttribute('data-category') || '';
    const matches = name.includes(query) && (category === 'All' || itemCategory === category);
    card.classList.toggle('is-filtered-out', !matches);
    if (matches) visible += 1;
  });
  if (visibleCount) visibleCount.textContent = String(visible);
  if (emptySearch instanceof HTMLElement) emptySearch.hidden = visible !== 0;
}

searchInput?.addEventListener('input', applyProductFilters);
categoryFilter?.addEventListener('change', applyProductFilters);
resetFilters?.addEventListener('click', () => {
  if (searchInput instanceof HTMLInputElement) searchInput.value = '';
  if (categoryFilter instanceof HTMLSelectElement) categoryFilter.value = 'All';
  applyProductFilters();
});
applyProductFilters();
