// The one JS copy of the mobile breakpoint (its Sass twin heads
// _sass/_mobile.scss). phone() is a function rather than a value because
// rotating a phone changes the answer, so callers check at event time;
// phoneQuery is for listeners that need the flip itself (settings.js).
var phoneQuery = window.matchMedia('(max-width: 700px)');
function phone() {
	return phoneQuery.matches;
}
