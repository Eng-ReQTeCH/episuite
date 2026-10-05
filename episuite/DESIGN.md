# Action-first redesign

The owner rejected the previous sage, rounded, wellness-style interface. Its earlier simulated score did not establish visual acceptance. This revision replaces that direction with charcoal navigation, a blue next-action surface, lime action emphasis, stronger typography and a flatter workspace. These are aesthetic choices, not scientifically established ADHD colors.

## What informed the interactions

[NICE ADHD guidance](https://www.nice.org.uk/guidance/ng87/chapter/recommendations) describes environmental modifications including reducing distractions, shorter periods of focus with movement breaks, and reinforcing requests with written instructions. Episuite uses short session choices, an explicit written first step, accessible breaks, and a quiet focus view. This is a design interpretation of those principles, not a clinical intervention trial.

[W3C cognitive accessibility guidance](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o5-user-focus/) recommends helping people focus and reorient through clear headings, navigation and reduced distractions. The persistent location label, consistent tools, thought parking, and low-stimulation option follow that direction.

No claim is made that a palette, reward animation or timer increases dopamine. ADHD preferences vary. The default is deliberately more visually distinctive; low-stimulation mode removes the large color surface and supporting panels. Motion can be disabled, including through the operating system preference.

## Concrete changes

- Now has a single next-action panel, a written first move, a readable timer and a three-segment shortlist progress indicator.
- Completed tasks update the count and segments immediately, with a brief background acknowledgment and a screen-reader status message. No confetti, flashing or looping attention grabs.
- Finishing the shortlist shows “Shortlist complete” and offers a break or closing the day. It does not demand another task.
- Breaks have their own heading, instructions and 2/5/10/15-minute choices; work-task controls are absent in the break view.
- The surrounding tools use tighter corners, flat surfaces and concise copy. Capture and restart are secondary to the current action.
- Light, dark and low-stimulation modes preserve text labels and keyboard focus indicators. Color is never the only completion cue.
- The logo, favicon, install metadata and offline shell match the new identity. All assets remain local.

## Verification

32 existing domain/server/integration/failure-case tests pass. Source validation passes. Browser walkthroughs in a separate disposable data directory exercised task creation, explicit tiny steps, a two-minute start, pause/reload persistence, completion/undo, keyboard capture, break selection, preference saving, phone navigation, dark and low-stimulation modes. Settings retain the chosen break duration when saved.

At 390 × 844, the document did not exceed the viewport width on Now, Tasks, My day, Focus, Capture, Progress, Rewards or Settings. Navigation scrolls inside its own row. Desktop and phone screenshots are under the ignored `test-results/` directory. The real workspace was not populated with test tasks.

The simulated judge remains a self-review. The owner's preference and actual sustained use are still needed to establish whether this visual direction is right for them.

Calculated text contrast for the main pairings: white on blue 6.26:1; supporting text on blue 5.08:1; main text on the workspace 14.22:1; secondary text on the workspace 5.12:1; lime button text 10.37:1; secondary text on a dark surface 7.42:1. These checks do not constitute a full accessibility audit.
