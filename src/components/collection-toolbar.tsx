export function CollectionToolbar({ q = "", sort = "featured", size = "" }: { q?: string; sort?: string; size?: string }) {
  return (
    <form className="collection-toolbar" action="/search" method="get">
      <label><span>Search catalogue</span><input name="q" defaultValue={q} placeholder="Search by name or SKU" minLength={2} /></label>
      <label><span>Size</span><select name="size" defaultValue={size}><option value="">All sizes</option><option value="52">52</option><option value="54">54</option><option value="56">56</option></select></label>
      <label><span>Sort</span><select name="sort" defaultValue={sort}><option value="featured">Featured</option><option value="newest">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></label>
      <button className="button button--dark" type="submit">Apply</button>
      {(q || size || sort !== "featured") ? <a className="text-link" href="/search">Clear all</a> : null}
    </form>
  );
}
