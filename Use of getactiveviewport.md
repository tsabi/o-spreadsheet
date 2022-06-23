model : Creating GridRenderingContext.viewport => Purged [V]

autofill : onMouseDown/Move : getting offsetX and offsetY to get left/top of the autofill zone

collaborative_client_tag : using viewport in a getRect
gridComposer : calling getActiveViewport in a getRect

container : getting offsetX and Y to position item

grid > errorTooltip : getting viewport to call getRect > shouldDisplayLink : getting viewport to check if the cell is visible in it => using only the zone > popoverPosition : using viewport in a getRect > onScroll : getting scrollbarOffset X/Y to check if we are really scrolling > autofill position : gett offsetX, offsetY > drawgrid: need offsetScrollbar values > edgescroll: need viewport zone to compute a new offset to apply

Drag and Drop => compliqué a expliquer : need viewport zone to compute a new offset to apply

Component Corner:get offsetX and Y to position corner in the viewport
Component Border:get offsetX and Y to position corner in the viewport

headers-overlay: needs to know the wnhole viewport displayed zone (left, right , top, bottom)
