import React, { useLayoutEffect, useRef, useState } from 'react';

import { useDebounceCallback } from 'usehooks-ts'

import { set, isVertical, isNegetiveDirection } from './helpers';
import { TRANSITIONS, VELOCITY_THRESHOLD } from './constants';
import { useControllableState } from './use-controllable-state';
import { DrawerDirection, SnapPoint } from './types';

export function useSnapPoints({
  activeSnapPointProp,
  setActiveSnapPointProp,
  snapPoints,
  drawerRef,
  overlayRef,
  fadeFromIndex,
  onSnapPointChange,
  direction = 'bottom',
  fastDragSkipsToEnd = true,
  log
}: {
  activeSnapPointProp?: number | string | null;
  setActiveSnapPointProp?(snapPoint: number | null | string): void;
  snapPoints?: (number | string)[];
  fadeFromIndex?: number;
  drawerRef: React.RefObject<HTMLDivElement>;
  overlayRef: React.RefObject<HTMLDivElement>;
  onSnapPointChange(activeSnapPointIndex: number): void;
  direction?: DrawerDirection;
  fastDragSkipsToEnd?: boolean;
  log: (s: string) => void
}) {

  const vertical = isVertical(direction)
  const negDirection = isNegetiveDirection(direction)

  const [activeSnapPoint, setActiveSnapPoint] = useControllableState<string | number | null>({
    prop: activeSnapPointProp,
    defaultProp: snapPoints?.[0],
    onChange: setActiveSnapPointProp,
  });

  const snapPointsAsOffsetsRef = useRef<number[]>([]) 
  const [triggerRefresh, setTriggerRefresh] = useState<string>('anything') 

  const onResize = () => { 


    const windowSize = vertical ? window.innerHeight : window.innerWidth 
log("REACT-DRAWER onResize() window size: " + windowSize)
log("REACT-DRAWER onResize() snapPoints: " + snapPoints)

      // snapoints may be null
    const _snapPointsOffset = snapPoints?.map((snapPoint) => {

      const hasWindow = typeof window !== 'undefined'
      const isPx = typeof snapPoint === 'string'

      const scalarDrawerSize = isPx ? parseInt(snapPoint, 10) : (windowSize * snapPoint) // fraction
      return !hasWindow ? 
        scalarDrawerSize 
        : 
        (negDirection ? windowSize - scalarDrawerSize : scalarDrawerSize - windowSize)

      }) ?? []

log("REACT-DRAWER onResize() snapPointOffsets: " + _snapPointsOffset)

      snapPointsAsOffsetsRef.current = _snapPointsOffset
      setTriggerRefresh('any string ' + windowSize)
  }

  const onResize_debounced = useDebounceCallback(onResize, 100)

  useLayoutEffect(() => {
    onResize()
    window.addEventListener('resize', onResize_debounced);
    return () => {
      window.removeEventListener('resize', onResize_debounced)
    }
  }, [vertical, snapPoints])

  const isLastSnapPoint = React.useMemo(
    () => activeSnapPoint === snapPoints?.[snapPoints.length - 1] || null,
    [snapPoints, activeSnapPoint],
  );

  const shouldFade =
    (snapPoints &&
      snapPoints.length > 0 &&
      (fadeFromIndex || fadeFromIndex === 0) &&
      !Number.isNaN(fadeFromIndex) &&
      snapPoints[fadeFromIndex] === activeSnapPoint) ||
    !snapPoints;

  const activeSnapPointIndex = React.useMemo(
    () => snapPoints?.findIndex((snapPoint) => snapPoint === activeSnapPoint),
    [snapPoints, activeSnapPoint],
  );

  const activeSnapPointOffset = React.useMemo(
    () => (activeSnapPointIndex < snapPointsAsOffsetsRef.current.length ? 
      snapPointsAsOffsetsRef.current[activeSnapPointIndex] 
      : 
      null
    ),
    [snapPointsAsOffsetsRef.current, activeSnapPointIndex],
  );

  const snapToPoint = React.useCallback(
    (dimension: number) => {
      const newSnapPointIndex = snapPointsAsOffsetsRef.current.findIndex((snapPointDim) => (snapPointDim === dimension));
      onSnapPointChange(newSnapPointIndex);
      set(drawerRef.current, {
        transition: `transform ${TRANSITIONS.DURATION}s cubic-bezier(${TRANSITIONS.EASE.join(',')})`,
        transform: vertical ? `translate3d(0, ${dimension}px, 0)` : `translate3d(${dimension}px, 0, 0)`,
      });

      if (
        newSnapPointIndex !== snapPointsAsOffsetsRef.current.length - 1 &&
        newSnapPointIndex !== fadeFromIndex
      ) {
        set(overlayRef.current, {
          transition: `opacity ${TRANSITIONS.DURATION}s cubic-bezier(${TRANSITIONS.EASE.join(',')})`,
          opacity: '0',
        });
      } else {
        set(overlayRef.current, {
          transition: `opacity ${TRANSITIONS.DURATION}s cubic-bezier(${TRANSITIONS.EASE.join(',')})`,
          opacity: '1',
        });
      }

      setActiveSnapPoint(newSnapPointIndex !== null ? snapPoints?.[newSnapPointIndex] : null);
    },
    [drawerRef.current, snapPoints, snapPointsAsOffsetsRef.current, fadeFromIndex, overlayRef, setActiveSnapPoint],
  );

  React.useEffect(() => {
    if (activeSnapPoint || activeSnapPointProp) {
      const newIndex =
        snapPoints?.findIndex((snapPoint) => snapPoint === activeSnapPointProp || snapPoint === activeSnapPoint) ??
        -1;
      if (newIndex !== -1 && newIndex < snapPointsAsOffsetsRef.current.length) {
          // :aa do not animate, since this is likely happening as a result of a window resize on drag (debounced)
        snapToPoint(snapPointsAsOffsetsRef.current[newIndex])
      }
    }
  }, [activeSnapPoint, activeSnapPointProp, snapPoints, snapPointsAsOffsetsRef.current, snapToPoint]);

  function onRelease({
    draggedDistance, // :aa direction indicated with > or <  zero
    elapsedTime,
    velocity,
    closeDrawer,
    dismissible,
  }: {
    draggedDistance: number;
    elapsedTime: number;
    velocity: number;
    closeDrawer: () => void;
    dismissible: boolean;

  }): boolean /* was dragged */ {

    if (fadeFromIndex === undefined)  {
      return false;
    }

    const currentPosition =
      direction === 'bottom' || direction === 'right'
        ? (activeSnapPointOffset ?? 0) - draggedDistance
        : (activeSnapPointOffset ?? 0) + draggedDistance;
    const isOverlaySnapPoint = activeSnapPointIndex === fadeFromIndex - 1;
    const isFirst = activeSnapPointIndex === 0;
    const hasDraggedUp = draggedDistance > 0;

    if (isOverlaySnapPoint) {
      set(overlayRef.current, {
        transition: `opacity ${TRANSITIONS.DURATION}s cubic-bezier(${TRANSITIONS.EASE.join(',')})`,
      });
    }

    if (fastDragSkipsToEnd && velocity > 2 && !hasDraggedUp) {
      if (dismissible) closeDrawer();
      else snapToPoint(snapPointsAsOffsetsRef.current[0]); // snap to initial point
      return true;
    }

    if (fastDragSkipsToEnd && velocity > 2 && hasDraggedUp && snapPoints) {
      snapToPoint(snapPointsAsOffsetsRef.current[snapPointsAsOffsetsRef.current.length - 1]);
      return true;
    }

    // Find the closest snap point to the current position
    const closestSnapPoint = snapPointsAsOffsetsRef.current.reduce((prev, curr) => {
      if (typeof prev !== 'number' || typeof curr !== 'number') return prev;

      return Math.abs(curr - currentPosition) < Math.abs(prev - currentPosition) ? curr : prev;
    });

    const dim = vertical ? window.innerHeight : window.innerWidth;

    const dragDirection = hasDraggedUp ? 1 : -1; // 1 = up, -1 = down
    if (velocity > VELOCITY_THRESHOLD && Math.abs(draggedDistance) < dim * 0.4) {

      log("REACT-DRAWER: dragged ....") // =======================
        // Don't do anything if we swipe upwards while being on the last snap point
      if (dragDirection > 0 && isLastSnapPoint) {
        log("REACT-DRAWER: ... from top") // =======================
        snapToPoint(snapPointsAsOffsetsRef.current[snapPoints.length - 1]);
      }
      else if (isFirst && dragDirection < 0 && dismissible) {
        log("REACT-DRAWER: ...closed from lowest") // =======================
        closeDrawer();
      }
      else if (activeSnapPointIndex !== null) {
        log("REACT-DRAWER: ...to next point.") // =======================
        snapToPoint(snapPointsAsOffsetsRef.current[activeSnapPointIndex + dragDirection]);
      }
      return true;
    }
      // https://borstch.com/blog/javascript-touch-events-and-mobile-specific-considerations 
    if (Math.abs(draggedDistance) < 5 && elapsedTime < 200) {
      log("REACT-DRAWER: not dragged ....") // =======================
      return false;
    }
    if (Math.abs(draggedDistance) > 5) {
      log("REACT-DRAWER: dragged slowly to close or closest: " + closestSnapPoint) // =======================

      const firstSnapPointDistance = (): number => {
        let result: number
        if (typeof snapPoints[0] === 'string') {
          result = parseInt(snapPoints[0], 10) // eg, '200px'
        }
        else if (typeof snapPoints[0] === 'number') { 
          result = (snapPoints[0] as number) * dim // eg, 0.3
        }
        return result
      }

      if (isFirst && !hasDraggedUp && dismissible && (Math.abs(draggedDistance) > firstSnapPointDistance() / 2)) {
        closeDrawer();
      }
      else {
        snapToPoint(closestSnapPoint);
      }
      return true;
    }


    return true; // :aa Pretend we were dragged so we don't allow onClick
  }

  function onDrag({ draggedDistance }: { draggedDistance: number }) {
    if (activeSnapPointOffset === null) return;
    const newValue =
      direction === 'bottom' || direction === 'right'
        ? activeSnapPointOffset - draggedDistance
        : activeSnapPointOffset + draggedDistance;

    // Don't do anything if we exceed the last(biggest) snap point
    if ((direction === 'bottom' || direction === 'right') && newValue < snapPointsAsOffsetsRef.current[snapPointsAsOffsetsRef.current.length - 1]) {
      return;
    }
    if ((direction === 'top' || direction === 'left') && newValue > snapPointsAsOffsetsRef.current[snapPointsAsOffsetsRef.current.length - 1]) {
      return;
    }

    set(drawerRef.current, {
      transform: vertical ? `translate3d(0, ${newValue}px, 0)` : `translate3d(${newValue}px, 0, 0)`,
    });
  }

  function getPercentageDragged(absDraggedDistance: number, isDraggingDown: boolean) {
    if (!snapPoints || typeof activeSnapPointIndex !== 'number' || !snapPointsAsOffsetsRef.current || fadeFromIndex === undefined)
      return null;

    // If this is true we are dragging to a snap point that is supposed to have an overlay
    const isOverlaySnapPoint = activeSnapPointIndex === fadeFromIndex - 1;
    const isOverlaySnapPointOrHigher = activeSnapPointIndex >= fadeFromIndex;

    if (isOverlaySnapPointOrHigher && isDraggingDown) {
      return 0;
    }

    // Don't animate, but still use this one if we are dragging away from the overlaySnapPoint
    if (isOverlaySnapPoint && !isDraggingDown) return 1;
    if (!shouldFade && !isOverlaySnapPoint) return null;

    // Either fadeFrom index or the one before
    const targetSnapPointIndex = isOverlaySnapPoint ? activeSnapPointIndex + 1 : activeSnapPointIndex - 1;

    // Get the distance from overlaySnapPoint to the one before or vice-versa to calculate the opacity percentage accordingly
    const snapPointDistance = isOverlaySnapPoint
      ? snapPointsAsOffsetsRef.current[targetSnapPointIndex] - snapPointsAsOffsetsRef.current[targetSnapPointIndex - 1]
      : snapPointsAsOffsetsRef.current[targetSnapPointIndex + 1] - snapPointsAsOffsetsRef.current[targetSnapPointIndex];

    const percentageDragged = absDraggedDistance / Math.abs(snapPointDistance);

    if (isOverlaySnapPoint) {
      return 1 - percentageDragged;
    } else {
      return percentageDragged;
    }
  }

  return {
    isLastSnapPoint,
    activeSnapPoint,
    shouldFade,
    getPercentageDragged,
    setActiveSnapPoint,
    activeSnapPointIndex,
    onRelease,
    onDrag,
    snapPointsOffset: snapPointsAsOffsetsRef.current,
  };
}
