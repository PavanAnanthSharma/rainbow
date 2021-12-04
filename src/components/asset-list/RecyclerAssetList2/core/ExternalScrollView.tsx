import React, { useContext, useImperativeHandle } from 'react';
import { Animated as RNAnimated, ScrollViewProps } from 'react-native';
import BaseScrollView, {
  ScrollViewDefaultProps,
} from 'recyclerlistview/dist/reactnative/core/scrollcomponent/BaseScrollView';
import { useMemoOne } from 'use-memo-one';
import { useRecyclerAssetListPosition } from './Contexts';
import { StickyHeaderContext } from './StickyHeaders';

// @ts-ignore
const ExternalScrollViewWithRef = React.forwardRef(function ExternalScrollView(
  props: ScrollViewDefaultProps,
  ref
): BaseScrollView {
  const y = useRecyclerAssetListPosition()!;

  const { onScroll, ...rest } = props;
  const { scrollViewRef } = useContext(StickyHeaderContext)!;

  const event = useMemoOne(
    () =>
      RNAnimated.event(
        [
          {
            nativeEvent: {
              contentOffset: {
                y,
              },
            },
          },
        ],
        { listener: onScroll, useNativeDriver: true }
      ),
    [onScroll, y]
  );

  useImperativeHandle(ref, () => scrollViewRef.current);
  // @ts-ignore
  return (
    <RNAnimated.ScrollView
      {...(rest as ScrollViewProps)}
      onScroll={event}
      ref={scrollViewRef}
    />
  );
});
export default ExternalScrollViewWithRef;