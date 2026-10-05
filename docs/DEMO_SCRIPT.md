# Demo video script (about 4 minutes)

Record with Loom or the OBS screen recorder, with system audio **and** your microphone on. Before you start, press **Reset demo** and set `IGNORE_CALLING_HOURS=true` if you're recording outside 8 AM–7 PM IST.

| # | Time | Show | Say / do |
|---|---|---|---|
| 1 | 0:00–0:20 | Dashboard | "10 fictional customers whose autopay failed, worth ₹21,175. Each has a different failure reason. The agent picks a fix per reason." Point at the status pills and the guardrails section. |
| 2 | 0:20–1:40 | **Aarav: browser call** (insufficient funds, wants to pay) | Click *Talk in browser*. Give a wrong year first (it refuses and reveals nothing), then **1994**. Ask to pay now. The link appears in the SMS panel. Open it and pay with UPI `success@razorpay`. Say "I've paid". The agent checks and confirms. The status flips to **Recovered** and the KPI updates. |
| 3 | 1:40–2:40 | **Priya: real phone call to your own phone** (card expired) | Click *Call my phone* and answer. Say "can you just retry it tomorrow?" It explains a retry would fail on an expired card and sends a *pay + re-authorise autopay* link instead. |
| 4 | 2:40–3:20 | **Meera** (dispute) or **Arjun** (do-not-call), browser | Meera: "the money was already debited" → dispute raised, no payment pushed. Arjun: "stop calling me" → do-not-call; both call buttons are now disabled. |
| 5 | 3:20–4:00 | Detail panel + code | Open a customer to show the AI summary, the compliance check ("No issues flagged"), the recording and transcript. Briefly show `src/lib/tools.ts`: "rules live in code, not the prompt." |

Optional extras if you have time:

- **Vikram:** ask for a retry 10 days out. The agent offers the last allowed date instead.
- **Ananya:** ask for a callback at 9 PM. It's refused and the agent offers a time between 8 AM and 7 PM.
- **Fatima:** the agent opens in Hinglish.
