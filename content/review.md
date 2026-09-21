## The problem

A humanoid moving through a furnished room cannot be treated as a point following a collision-free floor path. A route may clear the feet while striking the head; a crouch may clear a beam while the trailing shoulder is still underneath it. The relevant object is a **whole-body trajectory through three-dimensional space**, including preparation, constrained passage and recovery.

We want a robot to use its observations, measured state and navigation goal to propose coordinated future motions that a fixed controller can actually track. Several motions may work: turn sideways, crouch, choose a different route, slow down, or stop when a passage cannot be established. A useful generator must preserve these alternatives without averaging them into a collision.

<div class="callout question"><span class="eyebrow">Our research question</span><p>Under limited representation and inference budgets, can scene–motion pretraining preserve the local geometric distinctions that change whole-body traversability, and help a conditional flow model choose an appropriate motion early enough to execute it?</p></div>

The phrase “critical moment” is a hypothesis about information, not a label for every low-clearance frame. The head’s closest approach may occur after the last practical time to start crouching. We therefore care about both **where the constraint occurs** and **when the policy must respond**. 小净空、关键决策时刻与高训练损失不是同一回事。

Our long-term task is conditional generation of a reference chunk **M**, given a causal observation map **S_obs**, measured history **h**, navigation goal **g**, and already committed reference prefix **P**:

```text
C = (S_obs, h, g, P)                  M ~ pθ(M | C)
reference → interface/codec → fixed tracker → executed motion
```

Success eventually means reaching the goal, clearing the obstacle with the whole body, avoiding prohibited contacts and falls, and completing recovery or stopping. A safe refusal is a separate outcome from successful traversal. Geometric clearance alone does not establish balance, support, joint feasibility, perception quality or tracking success.

### What exists today

The implemented generator emits only **crouch amplitude, yaw and lateral shift**, decoded into a seven-sphere motion proxy. It uses complete synthetic geometry and a fixed navigation direction. A separate branch audits native G1 reference geometry and temporal relations. These branches share research questions, but **the native-body studies are not evidence that the proxy FM already generates full G1 motion**.

<div class="scope-grid"><div><b>Completed</b><p>Controlled scene-representation studies; continuous proxy FM; bounded-output and solver comparisons; G1 asset/reference audits; body/time relation studies; certified candidate checking and exact fallback.</p></div><div><b>Still proposed</b><p>MTC pretraining; causal sensor-conditioned, varying-goal motion generation; a qualified motion codec; native SONIC-token prediction; closed-loop traversal with a fixed tracker.</p></div></div>

## System and data

<figure class="architecture"><svg viewBox="0 0 1000 290" role="img" aria-labelledby="arch-title arch-desc"><title id="arch-title">Proposed research system and the implemented proxy path</title><desc id="arch-desc">Observations and goals feed scene representations and a conditional flow generator. Decoded motion is checked before a future tracker interface. Dashed boxes indicate unimplemented deployment components.</desc><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#49635d"/></marker></defs><g fill="#edf4ef" stroke="#8caaa0"><rect x="10" y="55" width="180" height="100" rx="12"/><rect x="225" y="55" width="170" height="100" rx="12"/><rect x="430" y="55" width="165" height="100" rx="12"/><rect x="630" y="55" width="160" height="100" rx="12"/></g><rect x="825" y="55" width="165" height="100" rx="12" fill="#fff" stroke="#8caaa0" stroke-dasharray="6 5"/><g font-size="17" fill="#18352c" text-anchor="middle"><text x="100" y="90">Scene + goal</text><text x="100" y="119">+ state history</text><text x="310" y="90">Global context</text><text x="310" y="119">+ local relations</text><text x="512" y="90">Conditional FM</text><text x="512" y="119">motion proposal</text><text x="710" y="90">Decode + check</text><text x="710" y="119">+ select / abstain</text><text x="907" y="90">Fixed tracker</text><text x="907" y="119">+ execution</text></g><g stroke="#49635d" stroke-width="2" marker-end="url(#arrow)"><path d="M192 106H220"/><path d="M397 106H425"/><path d="M597 106H625"/><path d="M792 106H820"/></g><g font-size="13" fill="#52665f" text-anchor="middle"><text x="100" y="190">Today: full synthetic map</text><text x="310" y="190">32D + 12 anchor scores</text><text x="512" y="190">3 continuous controls</text><text x="710" y="190">Sphere-proxy geometry</text><text x="907" y="190">Future integration</text></g><path d="M907 160V240H100V164" fill="none" stroke="#8caaa0" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#arrow)"/><text x="500" y="266" text-anchor="middle" font-size="14" fill="#52665f">Proposed closed-loop state/observation feedback — not run in the experiments below</text></svg><figcaption>Solid boxes describe the implemented proxy research path, not a complete deployed navigation stack. The observation and goal contract must expand before deployment.</figcaption></figure>

### Four different meanings of “token”

| Representation | What it is | What must be verified |
|---|---|---|
| Transformer token | A sequence slot containing a learned feature vector | What information is accessible and how much geometry it reads |
| Motion latent | A code for a specified motion decoder | Reconstruction, temporal consistency and lost clearance |
| SONIC native token | A controller-specific learned/quantized representation | Exact encoder, quantizer, decoder, checkpoint and proprioception contract |
| Executed action | A command or measured outcome in a control loop | Tracking, latency, contact, balance and task success |

These are not interchangeable. Integer codebook IDs do not have a meaningful Euclidean interpolation just because they are called tokens. Continuous codec coordinates may be modeled with FM, but quantization and decoding need separate geometric and execution audits. The [SONIC paper](https://arxiv.org/html/2511.07820v4) and [official implementation](https://github.com/NVlabs/GR00T-WholeBodyControl) establish the relevant controller context; our work has checked offline formats, not run its learned motor encoder.

### Data sources have different jobs

[Moving Through Clutter (MTC)](https://arxiv.org/html/2603.05993v1) pairs embodiment-scaled VR locomotion with procedural scene geometry; v1 reports 348 trajectories across 145 scenes. It motivates learning the relationship between a constraint and an adaptation. Reading its paper does not qualify a local archive as MTC or establish robot executability.

| Data branch | Available evidence | Appropriate role | Missing evidence |
|---|---|---|---|
| Procedural box scenes + sphere motions | Exact continuous geometric labels for a declared proxy | Controlled representation, FM and checker experiments | Human motion, perception and dynamics |
| Kimodo-generated G1 references | 120 original clips / 29 ancestry groups; later 20 additional groups | Body geometry, interval bounds and typed relation supervision | Verified MTC provenance and qualified execution labels |
| MTC-style aligned captures | Literature motivation; no MTC training in this workspace | Proposed geometry-induced adaptation pretraining | Archive/license/export validation, alignment and quality gates |
| Tracker rollouts | Not collected by these experiments | Future executability, correction and failure supervision | Actual closed-loop outcomes |

The data model should preserve scene revisions and coordinate transforms; source ancestry and actor/session identity; original human and robot references; timestamps; sensor poses and visibility; measured versus reference state; tracker/version and command logs; and event/counterfactual provenance. Split source episodes and scene families **before** extracting overlapping windows. Nearby geometry variants and mirrored descendants must not cross the intended generalization boundary.

A motion does not uniquely identify the room that produced it. Crouching can reflect a beam, a preference, or a different task. Motion-to-scene pretraining should therefore infer supported relations or uncertain scene hypotheses, rather than claim uniquely recoverable complete geometry. Likewise, a randomly mismatched scene–motion pair is not automatically a negative: the motion may remain feasible there.

## Flow matching, carefully

### What is actually learned?

For a normalized continuous action chunk **X₁**, sample a source **X₀** and transport time **τ**. In our convention, noise is at zero and data at one:

```text
X₀ ~ N(0, I),     τ ~ Uniform(0, 1)
Xτ = (1 − τ) X₀ + τ X₁
u* = X₁ − X₀
LFM = E[ ||vθ(Xτ, τ, C) − u*||² ]

Inference: dXτ/dτ = vθ(Xτ, τ, C), starting at the declared source.
Euler:     Xτ+Δτ = Xτ + Δτ · vθ(Xτ, τ, C)
```

[Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) trains a vector field against a chosen probability path without simulating the learned ODE during each training example. The regression target belongs to sampled endpoint pairs; the learned field averages compatible conditional targets at a noisy state. The resulting marginal transport need not be a straight line for an individual generated sample. Independent noise/data pairing also does not, by itself, solve an optimal-transport coupling problem.

The following derivations and design choices apply that setup to **our proposed traversal system**. They are not new benchmark results.

### Two clocks, two spaces

**Transport time τ** indexes the refinement of an entire motion representation. **Physical time k** indexes positions inside the resulting motion chunk. A velocity in action-representation space is not a joint velocity or a robot’s speed through the room. Sources use opposite τ conventions; the interpolation, target sign and integration direction must agree.

<div class="interactive" id="flow-demo"><div class="demo-heading"><div><span class="eyebrow">Interactive explanation · illustrative only</span><h3>Move the two clocks independently</h3></div><button id="reset-demo" type="button">Reset</button></div><div class="demo-grid"><div><svg id="transport-plot" viewBox="0 0 440 245" role="img" aria-label="Prescribed interpolation from noise samples to two action modes"></svg><label for="transport">Transport time τ <output id="transport-value">0.45</output></label><input id="transport" type="range" min="0" max="100" value="45"/><p>Points are two abstract action coordinates. Each point represents a whole candidate, not a body moving through space.</p></div><div><svg id="physical-plot" viewBox="0 0 440 245" role="img" aria-label="Robot progressing along a candidate path around an obstacle"></svg><label for="physical">Physical chunk progress k/H <output id="physical-value">0.35</output></label><input id="physical" type="range" min="0" max="100" value="35"/><p>The marker advances through a schematic room along one candidate path. This clock is independent of τ.</p></div></div><p class="caption">Left: hand-constructed training-pair interpolation, not an integrated learned field. Right: an illustrative route, not a humanoid rollout. Neither figure reports an experiment.</p></div>

### Why generate chunks rather than one action?

A chunk can represent coordinated preparation, passage and recovery jointly. It can preserve distinct solutions where single-target regression would encourage an unhelpful average. But a horizon also commits the system to predictions made from aging observations. Generate the suffix that can still be changed, condition on the committed prefix, and retain measured state rather than substituting a perfect reference history.

FM is deterministic **conditional on its initial sample and conditioning**; different initial samples provide a distribution of outputs. Multiple outputs are useful only if they are valid, sufficiently diverse in behavior, and selected using information available at deployment. Best-of-K with ground-truth hindsight is an evaluation ceiling, not the performance of the actual selector.

### FM versus diffusion and other policies

| Choice | Useful property | Comparison that matters here |
|---|---|---|
| Flow matching | Direct velocity regression along a specified probability path; continuous action chunks | Validity and coverage versus actual total latency, with declared source and solver |
| Diffusion policy | Conditional multimodal action generation with denoising objectives and samplers | Matched data, conditioning access, tuning and wall-clock budget; diffusion can also use deterministic samplers |
| Discrete autoregression | Explicit token likelihood and sequential generation | Quantization fidelity, sequence cost and controller compatibility |
| Retrieval + editing | Strong use of a finite qualified motion library | Same tracker, geometry access, selection budget and editing cost |
| Optimization / MPC | Direct use of modeled objectives and constraints | Dynamics fidelity, initialization, feasible support and deadline behavior |
| Reactive RL policy | Can learn feedback and recovery in its training distribution | Task coverage, demonstrations, simulation cost and transfer |

FM is an important robotics approach, not the only mainstream route and not automatically safer or faster. [Diffusion Policy](https://diffusion-policy.cs.columbia.edu/) established action diffusion with receding-horizon control. [FAST](https://arxiv.org/abs/2501.09747) studies compressed action tokenization for autoregressive policies. A traversal contribution must improve an operational comparison rather than simply replace one generative loss with another.

### What do robotics systems add to the basic objective?

[π₀](https://arxiv.org/html/2410.24164v1) combines a pretrained vision-language backbone with a continuous action expert. Observation features and action slots play different roles; action chunks interact through attention. This supports transferring semantics into control, but does not establish a whole-body clutter solution. [OpenPI](https://github.com/Physical-Intelligence/openpi) also distinguishes flow-based models from the autoregressive π₀-FAST branch: “VLA” does not imply one action representation.

[3D FlowMatch Actor](https://arxiv.org/html/2508.11002v1) is a useful manipulation reference for relating action and scene features in common 3D coordinates. Our analogous question is whether body-sweep-relative information survives compression. Its manipulation results cannot be treated as humanoid traversal evidence.

[PASSAGE](https://arxiv.org/html/2609.18732v1) is a close scene-conditioned humanoid reference: it predicts continuous motion chunks from history, a destination and a multi-layer map, then uses a perceptive tracker. [TANGO](https://arxiv.org/html/2609.09158v1) connects a whole-body VLA action expert to SONIC, using execution-filtered reference supervision. Its predicted motion references should not be relabeled as directly predicted native controller tokens. These precedents mean our contribution cannot be “FM + scene conditioning + a tracker” alone.

### Source distributions, output charts and solver error

For a true temporal motion representation, a proposed correlated source could be

```text
X₀,F = μ(C) + LT ε,       LT LTᵀ = KT,       ε ~ N(0, I)
```

where **F** is the free suffix. A temporal kernel can encode smoother source samples, but should preserve enough support for rapid stepping and posture changes. Train with the source actually used at inference. Initializing from the previous prediction after training only on independent Gaussian noise changes the sampling distribution; it is not a free warm start. [ConFlow](https://arxiv.org/abs/2607.14424) provides relevant constrained-generation and structured-source context, so correlated sources should be treated as a comparison, not assumed novelty.

Our current three-control proxy has **no learned physical-time sequence axis**. A temporal-source study becomes meaningful only after defining a motion-chunk representation. For now, the bounded-chart experiment isolates a simpler issue: a better numerical solution can converge more accurately to an invalid model output. Euler256 improved numerical agreement but reduced valid yield. Tanh decoding fixed control bounds, while simple clipping was equally strong on the primary feasibility comparison.

Position, orientation and joint coordinates require explicit scaling. Straight interpolation between raw rotations can leave the rotation manifold; a continuous representation still needs a valid decoder. Tanh can enforce a box domain but cannot enforce collision freedom, contact or torque feasibility. More solver evaluations increase cost and reduce one source of numerical error; they do not repair a misspecified conditional distribution.

### Constraints belong to a declared object

Under the noise-at-zero convention, a one-step endpoint estimate is

```text
X̂₁ = Xτ + (1 − τ) vθ(Xτ, τ, C).
```

It is an estimate, not an exact future sample. Early in transport, its mean can lie between two valid modes. Penalizing every noisy intermediate state as though it were a physical trajectory may distort the learned distribution. A proposed geometry regularizer should state whether it acts on this estimate, a decoded terminal sample, or an executed trajectory—and account for the cost of obtaining gradients through the decoder.

[HardFlow](https://arxiv.org/abs/2511.08425) investigates terminal constrained sampling through trajectory optimization; [SafeFlow](https://arxiv.org/abs/2504.08661) uses control-barrier ideas; [UniConFlow](https://arxiv.org/abs/2506.02955) studies constrained flow-based planning. Their modeled constraints and assumptions do not automatically cover our humanoid contact dynamics. Our completed work instead uses explicit terminal-domain handling and geometric checking; it has not trained a constraint-aware humanoid FM.

### Delay and committed actions

A robot continues moving while a new chunk is computed. Train over realistic committed-prefix lengths, mask the loss to editable coordinates, and measure queueing, communication, perception, generation and checking. [Training-Time Action Conditioning](https://arxiv.org/html/2512.05964v1) is directly relevant to modeling delayed prefixes. Demonstration prefixes remain cleaner than prefixes produced by an imperfect running policy; that gap needs evaluation.

Report network-function evaluations, but optimize the **complete useful-output cost**. In our CPU proxy, scene conditioning took much longer than the tiny FM integrator. A faster sampler alone would miss much of that implementation’s cost.

## Experiments and findings

The ledger below covers all **11 substantive study blocks** in this workspace, including negative results, audits and the latest hybrid check. Tiny smoke runs are implementation checks, not additional scientific trials. Original reports are available as plain-text evidence notes; they retain historical conclusions so later updates can be traced.

<div class="filters" role="group" aria-label="Filter experiments"><button class="active" type="button" data-filter="All" aria-pressed="true">All 11</button><button type="button" data-filter="Representation" aria-pressed="false">Representation</button><button type="button" data-filter="Generation" aria-pressed="false">Generation</button><button type="button" data-filter="Native geometry" aria-pressed="false">Native geometry</button><button type="button" data-filter="Checking" aria-pressed="false">Checking</button><span id="filter-status" aria-live="polite">11 studies</span></div>

<!-- EXPERIMENTS -->

### Read the latest cost result correctly

<figure><img src="assets/hybrid_results.png" alt="Seven hybrid-checker arms have identical validity; uniform16 has the lowest measured checker and assembled pipeline cost in this run." loading="lazy" width="2700" height="900"/><figcaption>Measured proxy experiment. Error bars are min/max across three repetitions, not confidence intervals. The assembled pipeline adds retained conditioning/FM/decoding timings; it is not a newly measured end-to-end robot latency. <a href="evidence/notes/HYBRID_CHECKER_RESULT_zh.txt">Detailed report</a> · <a href="assets/hybrid_results.pdf">PDF</a>.</figcaption></figure>

Uniform16 + fallback retains all exact decisions while reducing newly measured checker cost from 38.147 to 20.136 ms per valid return. Assembled pipeline means are 58.603 and 40.592 ms; exact timing varies substantially. The raw generator still produces only 9,962/13,824 valid candidates. Filtering cannot create a missing feasible action, and the 57/432 scene–model evaluations with no valid candidate remain unresolved by generation.

### Three results that changed the research plan

**Representation must preserve decisions, not just averages.** Reconstruction quality and relation supervision alone did not ensure safer choices. Local spatial correspondence helped, but deterministic geometry remained a strong baseline. The evidence favors measuring which decisions survive a representation rather than assuming a task-related loss solves compression.

**Critical-event learning and event observation are separate.** A five-frame torso collision escaped uniform reads. Increasing boundary-frame exposure during training nevertheless worsened the learned reader. The existence of an important event does not prove a particular sampler will learn it, or that deployment will observe it.

**Computation should be measured per useful result.** The first certified FM integration reduced queries but sacrificed output coverage. Exact fallback restored coverage. A simpler uniform prefilter then outperformed a more selective adaptive implementation in total cost. Query counts, network calls and model size are incomplete measures of efficiency.

## Critical events and attention

### The concrete missed event

Reference **00623 / obstacle 52** contains five source frames with a torso primitive overlap. A 16-frame uniform read missed all five; its minimum observed proxy clearance was about 0.182 m. Motion-bound reading also missed the event at budget16, even though its ranking rejected the candidate. A later budget study found its first witness at query24; endpoint reading found one at query11. The later result does not erase the original miss.

<figure><img src="assets/missed-event.png" alt="Archived diagnostic of the five-frame torso overlap missed by uniform time sampling." loading="lazy"/><figcaption>Measured native-reference diagnostic, not a robot execution trace. A negative primitive margin is evidence of overlap in the declared model, not a measured physical penetration depth. <a href="evidence/notes/NATIVE_EVENT_RESULT_zh.txt">Event study</a>.</figcaption></figure>

### Certify, witness, or remain unresolved

For endpoint clearances **dₐ, dᵦ** and a valid bound **B** on body motion along an interval, the 1-Lipschitz distance relation yields a continuous lower bound:

```text
lower[a,b] = (dₐ + dᵦ − B[a,b]) / 2
```

The bound uses accumulated motion, not just endpoint displacement: a body can leave and return. Accept only if every required body/interval is certified above the margin. Reject a witnessed prohibited overlap. Otherwise refine, fall back to a stronger checker, or abstain. A negative lower bound indicates inability to certify; it is not proof of collision.

For native meshes, separation of a verified outer envelope can certify separation, but envelope overlap does not prove the underlying mesh collides. This asymmetry is why our native labels explicitly retain unknowns. The proxy’s analytic exact checker and the native-body conservative checker have different label semantics.

### A proposed attention mechanism

Keep a coarse global route context, then query scene patches relative to the **swept volume of the candidate body**, not only joint centers. A potential score for physical step k, body b and scene patch j is:

```text
score(k,b,j) = Q(hkb)ᵀ K(fj) / √d
             + β(relative position, normal, time offset, visibility, observation age)
```

Body interactions and temporal interactions must coordinate the result: moving the head away from a beam should not place a shoulder into a wall. Retain a representation of observed free space, occupied space and unknown space. A beam disappearing from the camera does not cease to constrain the trailing body.

At high noise, a decoded candidate may be a poor spatial anchor. Begin with measured history and broad geometry, then consider model-generated clean estimates for local refinement while retaining global context. Train with the same source of anchors available at inference. Cropping scene information around the true future training trajectory would leak information unavailable to the deployed generator.

The local-query idea has precedents in [3D FlowMatch Actor](https://arxiv.org/html/2508.11002v1), terrain selection in [TAGA](https://arxiv.org/html/2606.05880v1), and scene-aware character modeling in [LINGO](https://arxiv.org/html/2410.03187v1). Our proposed contribution must be a measured improvement in preserved compatibility or action timing, not the presence of a cross-attention layer.

### What should pretraining preserve?

Proposed supervision predicts body/time compatibility, visibility and support-related relations for demonstrations **and alternative motions**. Use continuous geometry where available; use typed uncertain labels elsewhere. Match representation capacity, input access, label acquisition cost, optimizer exposure and inference budget across comparisons. A local reader that consults the full map cannot be advertised as a tiny standalone scene code.

Define an event window over preparation → constrained passage → whole-body exit → recovery. A stronger proposed event signal asks how much validated motion quality changes when adjustment is delayed, with the same repair and verification budget. A failed delayed reference only demonstrates sensitivity within that tested motion family; it does not prove no controller could recover.

Attention maps alone are not causal explanations. Test whether moving the relevant beam changes the predicted posture appropriately, whether removing its patch harms the corresponding behavior, and whether unrelated geometric edits leave the action stable. Compare uniform exposure, low-clearance exposure and delayed-adjustment sensitivity separately.

## Research roadmap

Our next work should resolve a bottleneck before adding architecture. The following stages are **plans, not completed experiments**; advancement depends on evidence rather than calendar dates.

| Stage | Decisive experiment | Primary measurement | Decision / stop condition |
|---|---|---|---|
| 1 · Diagnose generator support | Frozen FM versus independent domain search, under matched candidate and checking budgets; retain exact verification | Valid yield, scene coverage, search-found/FM-missed cases and cost | Search success isolates a missed feasible region. Search failure is “not found,” never proof of infeasibility. |
| 2 · Replicate the checking choice | Freeze uniform16 + fallback; compare with direct exact on new families and repeated timing | Identical accepted sets and selected actions; useful-output cost | Retain the hybrid only if its benefit survives the new workload. |
| 3 · Qualify scene–motion data | Verify MTC or another explicitly named paired corpus, transforms, ancestry, contacts, reference limits and observation contract | Usable independent episodes and typed exclusions | Do not train execution imitation on an unqualified reference just because it is finite. |
| 4 · Test task-preserving pretraining | Matched-capacity scene encoders; reconstruction versus compatibility supervision; fixed downstream probes and then fixed FM | Unsafe acceptance at matched coverage, raw generated validity, codec-added collisions | If no downstream improvement, do not scale the new loss. |
| 5 · Test event-aware temporal learning | Uniform versus reliable event mixtures with matched unique episodes, labels and compute | Preparation timing, brief-event misses, recovery before whole-body exit | If exposure helps only familiar layouts, investigate memorization and event leakage. |
| 6 · Expand the motion model | Continuous native references before optional codec/native-token comparison; iid versus structured temporal source | Geometry, range, temporal consistency, diversity and total sampling cost | Discard source/solver changes that improve numerical metrics without task benefit. |
| 7 · Close the loop | Same qualified tracker, scenes, sensing and tuning budget for retrieval/editing, baseline FM and proposed model | Goal completion, prohibited contacts, falls, safe refusals and latency percentiles | If tracking dominates even with oracle references, work on the execution interface first. |

### Three competing explanations to separate next

**Sampling coverage:** valid motions exist in the current control family, but 32 FM samples miss them. Independent search can expose those cases; increasing candidate count should then be compared at matched total cost.

**Conditioning insufficiency:** motions in the family could work, but the representation does not distinguish the critical geometry or goal. Intervention tests and a stronger geometry-conditioned baseline are needed. A search result alone cannot establish this cause.

**Expressive limits:** crouch/yaw/shift cannot represent the needed step, timing or route. An oracle upper bound over a larger, qualified motion family is informative. Failed finite search in the small family is insufficient to prove this explanation.

### An interpretable future ablation

After data and interfaces are qualified, begin with a small factorial comparison: compatibility supervision on/off × event mixture on/off, using one fixed backbone. Then separately test body-relative attention and source design. Preserve retrieval/editing, uniform local reads and exact geometry references. Report actual deployed selection alongside any hindsight best-of-K ceiling.

For codec studies, compare the original reference, decoded reference and executed motion on the same scene. Geometric loss after compression and tracking deviation are different errors. A proposed clearance budget can account for scene error, representation-induced body displacement and tracking error using explicit bounds; empirical quantiles are not automatically deterministic guarantees, and overlapping error terms must not be counted twice.

## Literature map

This is a targeted primary-source review refreshed **21 September 2026**, not a systematic claim to cover every robotics FM paper or establish novelty. Links below point to author papers or official code. Reported results from these systems are not reproduced by our proxy experiments.

| Source | What it contributes to the research question | Boundary |
|---|---|---|
| [Flow Matching](https://arxiv.org/abs/2210.02747) | Probability-path and vector-field training framework | A generative formulation, not a robot safety mechanism |
| [Diffusion Policy](https://diffusion-policy.cs.columbia.edu/) | Conditional action generation and receding-horizon policy design | A necessary generative-policy comparator |
| [π₀](https://arxiv.org/html/2410.24164v1) / [OpenPI](https://github.com/Physical-Intelligence/openpi) | Vision-language features plus continuous action generation | General robot manipulation evidence does not establish our traversal task |
| [FAST](https://arxiv.org/abs/2501.09747) | Action tokenization for autoregressive models | Continuous FM is not the only viable action head |
| [GR00T N1](https://arxiv.org/abs/2503.14734) | A generalist humanoid foundation-model reference | Different system and data contract from native SONIC-token prediction |
| [MTC](https://arxiv.org/html/2603.05993v1) | Aligned clutter geometry and embodiment-scaled traversal capture | Local archive qualification remains separate |
| [PASSAGE](https://arxiv.org/html/2609.18732v1) | Scene-conditioned continuous humanoid planning and perceptive tracking | Closely related system; component composition is not our novelty |
| [TANGO](https://arxiv.org/html/2609.09158v1) | Whole-body VLA navigation with SONIC and filtered reference supervision | Reference chunks are not automatically native controller tokens |
| [SONIC](https://arxiv.org/html/2511.07820v4) / [code](https://github.com/NVlabs/GR00T-WholeBodyControl) | Universal motion representation and whole-body tracking interfaces | Checkpoint and observation compatibility must be pinned |
| [3D FlowMatch Actor](https://arxiv.org/html/2508.11002v1) | 3D scene/action correspondence for manipulation | Whole-body swept-volume relations need separate validation |
| [TAGA](https://arxiv.org/html/2606.05880v1) / [LINGO](https://arxiv.org/html/2410.03187v1) | Relevant local geometry selection and character–scene context | Terrain/character evidence does not qualify our controller |
| [Training-Time Action Conditioning](https://arxiv.org/html/2512.05964v1) | Conditioning on committed prefixes under delay | Measured-state and generated-prefix shifts remain important |
| [ConFlow](https://arxiv.org/abs/2607.14424) | Constrained motion learning and structured sources | Abstract/method-level context here; not a reproduced baseline |
| [HardFlow](https://arxiv.org/abs/2511.08425) | Terminal-sample constraints through optimization | Modeled feasibility differs from tracking/contact feasibility |
| [SafeFlow](https://arxiv.org/abs/2504.08661) / [UniConFlow](https://arxiv.org/abs/2506.02955) | Barrier and constrained-planning alternatives | Their assumptions must be re-established for our system |

Bibliographic correction: earlier local notes called arXiv:2504.08661 “SafeFM”; its current title is **SafeFlow**. Historical notes are retained, while this review uses the verified title. Dates and versioned links identify what was read; no priority or first-in-literature claim is made.

## Evidence and limitations

### Do not mix these denominators

| Metric | Denominator | What it answers |
|---|---|---|
| Pilot false-safe rate | All actually unsafe candidates | How many unsafe candidates are mistakenly accepted? |
| Unsafe fraction at fixed coverage | Accepted candidates | How contaminated is the selected set at this acceptance budget? |
| Native witness fraction | Accepted candidates, with unknowns separately reported | How many selected candidates have demonstrated primitive overlap? |
| Raw valid-candidate yield | All generated candidates, before filtering | How useful is the generator’s distribution? |
| Valid scene return | All scene–model evaluations | Did the actual selector return a valid motion? |
| Certification coverage | All examined candidates | How many can this finite-query checker itself prove clear? |
| Cost per valid return | Total relevant batch cost / valid returns | How much computation is paid for each useful output, including failed scenes? |

Percentages from different test draws or different denominators should not be plotted as one learning curve. Multiple fitted seeds are not additional independent scenes. Family/source-group bootstrap intervals condition on the fitted models; they do not include every form of training or acquisition uncertainty. Three timing repetitions give a descriptive range, not a population confidence interval.

### Corrections remain visible

The native audit initially left 71/240 scenes unresolved; later interval refinement supplied certificates for them. This is additional evidence, not a claim that the first audit found collisions. The five-frame event remained missed at the original 16-query budget. The FM checker’s float32 box-center mismatch was corrected by promoting geometry before arithmetic and rerunning all arms on the identical frozen bank; the audit tolerance was not relaxed. Original attempts remain in the local archive.

The latest hybrid implementation passed **75 tests**, replayed **82,944 certificate sets**, and checked **96,768 candidate decisions** across 21 arm/model traces. Those replay counts include repeated checking of the same 13,824 candidates. They are verification work, not new data or robot trials.

### What this website publishes

This public review includes the study ledger, original research-note snapshots with machine-specific home paths generalized, selected scientific figures, and a SHA-256 source/publication manifest. Model weights, original motion archives, robot assets, full prediction arrays and large local experiment bundles are **not included**. Source reports describe the locally available reproduction commands and artifact identifiers; those internal identifiers are not public download promises.

<div class="download-grid"><a href="data/experiments.json">Study ledger · JSON</a><a href="evidence/manifest.json">Source/publication manifest · JSON</a><a href="content/review.md">Full English research review · Markdown</a><a href="evidence/notes/HYBRID_CHECKER_RESULT_zh.txt">Latest detailed report · 中文</a></div>

<!-- NOTES -->

## Related projects

This page covers the Motion2Scene Flow experiments in the current workspace. The public repositories below provide the broader research context; their results have **not** been pooled into this page’s experimental counts or independently re-audited here. Descriptions follow their public repository metadata.

| Project | Role in the broader program |
|---|---|
| [Hindsight Motion Research](https://github.com/linjiw/hindsight-motion-research) | Whole-body motion representations and hindsight critical-scene proposals |
| [Motion2Scene Training](https://github.com/linjiw/motion2scene-training) | Motion-derived scenes, teacher/student training, qualification and navigation experiments |
| [Scene2Motion-G1](https://linjiw.github.io/scene2motion/) | Auditing a frozen motion prior as a scene-conditioned traversal module |
| [SONIC SIM Track B](https://github.com/linjiw/groot-wbc-sonic-sim-trackb) | Bounded simulation evaluation and curriculum/checkpoint provenance |
| [CLIMB](https://github.com/linjiw/climb-feasibility-first) | Feasibility-first motion tracking and retargeting research record |
| [refeas](https://github.com/linjiw/refeas) | Dynamic-feasibility screening for retargeted motion data |
| [Newton Terrain Lab](https://linjiw.github.io/newton-terrain-lab/) | Terrain generation and experimental humanoid tracking |
| [LUCID](https://github.com/linjiw/lucid) | Motion-tracking curriculum research workspace |

The organizing idea across this review is to keep **representation, generation, verification and execution measurable separately**, then demonstrate that a proposed improvement survives their integration.
