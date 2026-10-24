import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { WrappedSlide } from '@/domain/summary/wrapped';
import { Button, Icon, useBottomInset } from '@/ui';

import { SlideView } from './components/SlideView';
import { parseWrappedScope, stepSlide } from './scope';
import { useWrapped } from './useWrapped';
import { useWrappedMusic, type WrappedMusic } from './useWrappedMusic';

const BAR_HEIGHT = 72;

export function WrappedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ scope?: string; year?: string }>();
  const scope = parseWrappedScope(params.scope, params.year);
  const slides = useWrapped(scope);
  const music = useWrappedMusic(slides !== undefined && slides.length > 0);
  const [index, setIndex] = useState(0);
  const insets = useSafeAreaInsets();
  const barTop = insets.top;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/insights'));

  if (slides === undefined) return <View testID="wrappedLoading" className="flex-1 bg-ink" />;
  if (slides.length === 0) return <Empty onClose={close} />;

  const slide = slides[Math.min(index, slides.length - 1)] as WrappedSlide;
  const last = index >= slides.length - 1;
  const go = (step: 1 | -1) => setIndex((i) => stepSlide(i, slides.length, step));

  return (
    <Frame tone={slide.tone}>
      <View className="flex-1" style={{ paddingTop: barTop + BAR_HEIGHT }}>
        <SlideView key={index} slide={slide} />
      </View>

      <View className="absolute inset-0 flex-row" style={{ top: barTop + BAR_HEIGHT }}>
        <Pressable
          testID="wrappedPrevZone"
          accessibilityRole="button"
          accessibilityLabel="Previous slide"
          className="flex-1"
          onPress={() => go(-1)}
        />
        <Pressable
          testID="wrappedNextZone"
          accessibilityRole="button"
          accessibilityLabel="Next slide"
          className="flex-[2]"
          onPress={() => go(1)}
        />
      </View>

      <View
        pointerEvents="box-none"
        className="absolute inset-x-0 flex-row items-center gap-3 px-5"
        style={{ top: barTop, height: BAR_HEIGHT }}
      >
        <View testID="wrappedProgress" className="flex-1 flex-row gap-1">
          {slides.map((s, i) => (
            <View
              key={s.kind}
              testID={`wrappedSegment-${i}`}
              className="h-1 flex-1 rounded-full"
              style={{ backgroundColor: slide.tone.fg, opacity: i <= index ? 1 : 0.25 }}
            />
          ))}
        </View>
        {music.available ? <MuteButton music={music} color={slide.tone.fg} /> : null}
        <Pressable
          testID="wrappedClose"
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={close}
          className="size-11 items-center justify-center"
        >
          <Icon name="close" size={18} color={slide.tone.fg} strokeWidth={2.2} />
        </Pressable>
      </View>

      {last ? <DoneButton onPress={close} /> : null}
    </Frame>
  );
}

function MuteButton({ music, color }: { music: WrappedMusic; color: string }) {
  return (
    <Pressable
      testID="wrappedMuteBtn"
      accessibilityRole="button"
      accessibilityLabel={music.muted ? 'Turn music on' : 'Turn music off'}
      onPress={music.toggleMute}
      className="size-11 items-center justify-center"
    >
      <Icon name={music.muted ? 'speakerOff' : 'speaker'} size={20} color={color} strokeWidth={2} />
    </Pressable>
  );
}

function Frame({ tone, children }: { tone: { bg: string; fg: string }; children: ReactNode }) {
  return (
    <View testID="wrappedScreen" className="flex-1" style={{ backgroundColor: tone.bg }}>
      <StatusBar style={tone.fg === '#FFFFFF' ? 'light' : 'dark'} />
      {children}
    </View>
  );
}

function DoneButton({ onPress }: { onPress: () => void }) {
  const bottom = useBottomInset();
  return (
    <View className="absolute inset-x-0 bottom-0 px-7" style={{ paddingBottom: bottom + 24 }}>
      <Button testID="wrappedDone" label="Done" onPress={onPress} />
    </View>
  );
}

function Empty({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="wrappedEmpty"
      className="flex-1 justify-center gap-3 bg-ground px-7"
      style={{ paddingTop: insets.top }}
    >
      <StatusBar style="dark" />
      <Text className="font-tight-extrabold text-[28px] leading-9 text-ink">
        Nothing to wrap yet.
      </Text>
      <Text className="font-inter text-body leading-6 text-muted">
        Once payments are read from your messages, your wrapped shows up here.
      </Text>
      <View className="pt-4">
        <Button testID="wrappedClose" label="Close" variant="outline" onPress={onClose} />
      </View>
    </View>
  );
}
