# 303. papers: fail the build on a dangling id in _data/ml_literature.yml,
# which would otherwise blank the reader with a script error in the browser.
Jekyll::Hooks.register :site, :post_read do |site|
  lit = site.data["ml_literature"]
  ids = lit["papers"].map { |p| p["id"] }
  subs = lit["shelves"].to_h { |s| [s["id"], s["subs"].map { |x| x["id"] }] }
  venues = lit["venues"].map { |v| v["id"] }
  types = lit["venue_types"].map { |t| t["id"] }
  lit["venues"].each do |v|
    raise "ml_literature.yml: venue #{v["id"]} has unknown type #{v["type"]}" unless types.include?(v["type"])
  end
  lit["papers"].each do |p|
    bad = (p["builds_on"] - ids).map { |o| "builds_on #{o}" }
    bad << "venue #{p["venue"]}" unless venues.include?(p["venue"])
    bad << "shelf #{p["shelf"]}" unless subs.key?(p["shelf"])
    bad << "sub #{p["sub"]}" if subs.key?(p["shelf"]) && !subs[p["shelf"]].include?(p["sub"])
    raise "ml_literature.yml: paper #{p["id"]} has unknown #{bad.join(", ")}" unless bad.empty?
  end
end
