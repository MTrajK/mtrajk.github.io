const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function revealUnits(text) {
  return text.split(/(\x1b\[[0-9;]*m)/).flatMap(part =>
    part.startsWith("\x1b[") ? [part]
      : Array.from(segmenter.segment(part), item => item.segment),
  );
}

export function createReveal(length, update, complete) {
  const step = Math.max(8, Math.ceil(length / 50));
  let position = 0;
  let active = true;
  let timer = setTimeout(tick, 24);
  function tick() {
    if (!active) return;
    position = Math.min(length, position + step);
    update(position);
    if (!active) return;
    if (position === length) {
      active = false;
      complete();
    } else timer = setTimeout(tick, 24);
  }
  return {
    finish() {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      update(length);
      complete();
    },
    cancel() {
      active = false;
      clearTimeout(timer);
    },
  };
}
