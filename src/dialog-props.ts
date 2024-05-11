interface WithFadeFromProps {
  snapPoints: (number | string)[];
  fadeFromIndex: number;
}

interface WithoutFadeFromProps {
  snapPoints?: (number | string)[];
  fadeFromIndex?: never;
}

type DialogProps = {
  activeSnapPoint?: number | string | null;
  setActiveSnapPoint?: (snapPoint: number | string | null) => void;
  children?: React.ReactNode;
  open?: boolean;
  closeThreshold?: number;
  onOpenChange?: (open: boolean) => void;
  shouldScaleBackground?: boolean;
  scrollLockTimeout?: number;
  fixed?: boolean;
  dismissible?: boolean;
  handleOnly?: boolean;
  fastDragSkipsToEnd?: boolean;
  onDrag?: (event: React.PointerEvent<HTMLDivElement>, percentageDragged: number) => void;
  onRelease?: (event: React.PointerEvent<HTMLDivElement>, open: boolean) => void;
  modal?: boolean;
  nested?: boolean;
    /** 
     * If supplied, will be called when any gesture / event would
     * normally close the drawer.  If the default close behavior is also desired, 
     * this function should return false.
    */
  handleCloseGesture?: () => boolean;
  setActiveSPIndexSetter?: (fn: (index: number) => void) => void;
  onClose?: () => void;
  direction?: 'top' | 'bottom' | 'left' | 'right';
  preventScrollRestoration?: boolean;
  disablePreventScroll?: boolean;
} & (WithFadeFromProps | WithoutFadeFromProps)

export { type DialogProps as default }
