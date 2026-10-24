import { useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { pesewas, splitGhs } from '@/domain/money';
import type { WrappedSlide } from '@/domain/summary/wrapped';

const COUNT_MS = 900;
const SLIDE_MS = 420;

/** 0 to 1 over `ms`, or straight to 1 when the phone asks for reduced motion. */
function useProgress(ms: number) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, { duration: ms, easing: Easing.out(Easing.cubic) });
  }, [reduced, ms, progress]);
  return progress;
}

/** A number that counts up from zero; `format` turns the running value into text. */
function CountUp({
  to,
  format,
  children,
}: {
  to: number;
  format: (n: number) => string;
  children: (text: string) => ReactNode;
}) {
  const reduced = useReducedMotion();
  const progress = useProgress(COUNT_MS);
  const [current, setCurrent] = useState(reduced ? to : 0);
  useAnimatedReaction(
    () => Math.round(progress.value * to),
    (value, previous) => {
      // Only the number crosses to the JS thread; `format` is plain JS and cannot run on the UI runtime.
      if (value !== previous) scheduleOnRN(setCurrent, value);
    },
    [to],
  );
  useEffect(() => {
    // Settle on the exact final value; the reaction can skip the last frame.
    const done = setTimeout(() => setCurrent(to), reduced ? 0 : COUNT_MS + 50);
    return () => clearTimeout(done);
  }, [to, reduced]);
  return <>{children(format(current))}</>;
}

const money = (n: number) => splitGhs(pesewas(n)).whole.replace('GHS ', '');
const percent = (n: number) => `${n}%`;

function Big({ slide }: { slide: WrappedSlide }) {
  const color = { color: slide.tone.fg };
  const { big } = slide;
  if (big.kind === 'text') {
    return (
      <Text
        testID="wrappedBig"
        numberOfLines={3}
        adjustsFontSizeToFit
        className="font-tight-extrabold text-[52px] leading-[56px] tracking-[-0.03em]"
        style={color}
      >
        {big.text}
      </Text>
    );
  }
  if (big.kind === 'percent') {
    return (
      <CountUp to={big.value} format={percent}>
        {(text) => (
          <Text
            testID="wrappedBig"
            numberOfLines={1}
            adjustsFontSizeToFit
            className="font-tight-extrabold text-[120px] leading-[124px] tracking-[-0.04em]"
            style={color}
          >
            {text}
          </Text>
        )}
      </CountUp>
    );
  }
  const cents = splitGhs(big.amount).fraction;
  return (
    <View className="gap-1">
      <Text className="font-tight-bold text-[22px] leading-7 opacity-70" style={color}>
        GHS
      </Text>
      <CountUp to={big.amount} format={money}>
        {(text) => (
          <Text
            testID="wrappedBig"
            numberOfLines={1}
            adjustsFontSizeToFit
            className="font-tight-extrabold text-[84px] leading-[88px] tracking-[-0.04em]"
            style={color}
          >
            {text}
            <Text className="font-tight-medium text-[36px] opacity-60">{cents}</Text>
          </Text>
        )}
      </CountUp>
    </View>
  );
}

/** One slide: label, the big number counting up, and a short line, sliding in from the right. */
export function SlideView({ slide }: { slide: WrappedSlide }) {
  const progress = useProgress(SLIDE_MS);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: (1 - progress.value) * 48 }],
  }));
  const color = { color: slide.tone.fg };

  return (
    <Animated.View
      testID={`wrappedSlide-${slide.kind}`}
      className={`flex-1 justify-center gap-5 px-7 ${slide.kind === 'closing' ? 'pb-32' : 'pb-10'}`}
      style={style}
    >
      <Text
        testID="wrappedLabel"
        className="font-inter-semibold text-[14px] uppercase leading-5 tracking-[0.12em] opacity-70"
        style={color}
      >
        {slide.label}
      </Text>
      <Big slide={slide} />
      <Text testID="wrappedLine" className="font-inter-medium text-[20px] leading-7" style={color}>
        {slide.line}
      </Text>
      {slide.kind === 'closing' ? (
        <Text testID="wrappedFootnote" className="font-inter text-caption opacity-70" style={color}>
          {slide.footnote}
        </Text>
      ) : null}
    </Animated.View>
  );
}
