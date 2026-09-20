// The one JS copy of the mobile breakpoint (its Sass twin heads
// _sass/_mobile.scss). A function rather than a value because rotating a
// phone changes the answer, so callers check at event time.
function phone() {
	return window.matchMedia('(max-width: 700px)').matches;
}
