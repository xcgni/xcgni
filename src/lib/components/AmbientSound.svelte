<script lang="ts">
  import { onDestroy } from 'svelte';

  // Optional ambient focus sound - a generative pad synthesized in-browser (no asset).
  // Honest framing: calm ambient audio for focus/comfort, NOT a clinical claim that any
  // frequency improves cognition. Default OFF; one toggle. Persists nothing.
  //
  // Design (why it sounds alive instead of like a held organ note):
  //  - a warm A-major-ish pad (A2/A3/E4/A4 with a slight detune pair) through a LOWPASS,
  //    so cheap speakers get warmth, not buzz;
  //  - a slow breath LFO (~0.07 Hz) swells the pad like slow breathing;
  //  - another very slow LFO drifts the filter cutoff, so the timbre never sits still;
  //  - a whisper of low-passed noise underneath - the "distant air" that makes synthetic
  //    pads read as organic.
  let on = false;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let stoppables: { stop: () => void }[] = [];
  let starting = false; // guard against rapid re-toggles racing

  async function start() {
    if (typeof window === 'undefined' || starting) return;
    starting = true;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) { starting = false; return; }
      // Create the context synchronously inside the gesture (Firefox needs this).
      const c = new AC();

      master = c.createGain();
      master.gain.setValueAtTime(0.0001, c.currentTime);
      master.connect(c.destination);

      // ---- pad: detuned chord through a gentle lowpass ----
      const padFilter = c.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 900;
      padFilter.Q.value = 0.4;

      const padGain = c.createGain();
      padGain.gain.value = 0.85;
      padFilter.connect(padGain);
      padGain.connect(master);

      const voices: [number, OscillatorType, number][] = [
        [110, 'sine', 0.10],      // A2: body (audible on good speakers, harmless on bad)
        [220, 'triangle', 0.12],  // A3: the core
        [220.4, 'triangle', 0.10],// slight detune: a slow, gentle beating
        [329.63, 'sine', 0.07],   // E4: the fifth, softly
        [440, 'sine', 0.05]       // A4: air, quietest
      ];
      for (const [f, type, g] of voices) {
        const osc = c.createOscillator();
        osc.type = type;
        osc.frequency.value = f;
        const vg = c.createGain();
        vg.gain.value = g;
        osc.connect(vg);
        vg.connect(padFilter);
        osc.start();
        stoppables.push(osc);
      }

      // breath: slow swell of the whole pad (base 0.85 ± 0.13 at ~0.07 Hz)
      const breath = c.createOscillator();
      breath.frequency.value = 0.07;
      const breathDepth = c.createGain();
      breathDepth.gain.value = 0.13;
      breath.connect(breathDepth);
      breathDepth.connect(padGain.gain);
      breath.start();
      stoppables.push(breath);

      // timbre drift: the filter cutoff wanders slowly (900 ± 140 Hz at ~0.03 Hz)
      const drift = c.createOscillator();
      drift.frequency.value = 0.03;
      const driftDepth = c.createGain();
      driftDepth.gain.value = 140;
      drift.connect(driftDepth);
      driftDepth.connect(padFilter.frequency);
      drift.start();
      stoppables.push(drift);

      // ---- air: a whisper of low-passed noise ----
      const noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const noise = c.createBufferSource();
      noise.buffer = noiseBuf;
      noise.loop = true;
      const noiseFilter = c.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 260;
      const noiseGain = c.createGain();
      noiseGain.gain.value = 0.05;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(master);
      noise.start();
      stoppables.push(noise);

      // Resume AFTER wiring (the graph is ready the instant it runs).
      if (c.state === 'suspended') {
        try { await c.resume(); } catch { /* stays silent; the toggle simply does nothing */ }
      }
      if (!on) { try { await c.close(); } catch { /* ignore */ } stoppables = []; starting = false; return; }

      ctx = c;
      // long, gentle fade-in to a calm level (a focus pad should be felt, not noticed)
      master.gain.exponentialRampToValueAtTime(0.3, c.currentTime + 2.5);
    } catch {
      /* audio is a nicety; never let it break the page */
    } finally {
      starting = false;
    }
  }

  function stop() {
    if (ctx && master) {
      const c = ctx;
      try { master.gain.cancelScheduledValues(c.currentTime); } catch { /* ignore */ }
      try { master.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.8); } catch { /* ignore */ }
      const toStop = stoppables;
      stoppables = [];
      setTimeout(() => {
        toStop.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
        try { c.close(); } catch { /* ignore */ }
      }, 900);
      ctx = null;
      master = null;
    }
  }

  async function toggle() {
    on = !on;
    if (on) await start();
    else stop();
  }

  onDestroy(stop);
</script>

<button
  on:click={toggle}
  class="flex items-center gap-1.5 text-xs transition-colors {on ? 'text-accent' : 'text-muted hover:text-body'}"
  title="Optional ambient focus sound"
  aria-pressed={on}
>
  <span class="text-sm">{on ? '♫' : '♪'}</span>
  <span>{on ? 'Sound on' : 'Ambient sound'}</span>
</button>
