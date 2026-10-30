# ILLAPA project brief

*Hack the Andes 2026 · Track 1 Clima y Territorio · illapa.app · Draft for team review*

## In one line

ILLAPA tells a route planner whether a trip on a Peruvian road is safe now and in the next 24 hours, and what to do: continue, monitor, delay or reroute.

**Tagline:** Anticipa el riesgo. Protege tu ruta.

## Problem

- Huaicos, floods and landslides cut Peru's roads every rainy season and stop supply chains.
- The warning signs are public but scattered across SUTRAN, MTC/Provías, INDECI, SENAMHI, CENEPRED and the news.
- Planners check those sites by hand, or find out about a closure when the truck is already stuck.

## Who it is for

- **Primary user:** the route planner at a freight carrier or agroexporter.
- **Later:** dispatchers tracking trips on the road, risk and continuity analysts, and public road and emergency teams (MTC, Provías, COER).

## How it works

- **Reactive:** shows confirmed closures and restrictions on the route, from official feeds first and news second.
- **Predictive:** rates every ~5 km of the route as Bajo, Moderado, Alto or Crítico for now and 24 h ahead (48 and 72 h later), from forecast rain, terrain and past incidents.
- **Decision:** a fixed rules table recommends Continuar, Monitorear, Retrasar or Desviar, and finds the lowest-risk route on our road graph, with SUTRAN's official detours that fit the vehicle as fallback.
- **Explanation:** AI writes a short summary and preventive plan. Every claim cites its source and time.

## Three kinds of signal

We never merge these into one generic alert.

- **Confirmed disruption:** an agency reports it now. Example: SUTRAN reports PE-22 restricted at km 51.
- **Forecast hazard:** expected within 24 hours. Example: heavy rain forecast over a landslide-prone stretch tomorrow.
- **Baseline exposure:** risky by terrain or history, whatever the weather. Example: a stretch with many past road emergencies.

## Limitations

- Guidance only. It does not replace official SENAMHI, INDECI or SUTRAN warnings or the authorities' decisions.
- Upstream feeds are undocumented public endpoints. They can change or go down without notice.
- Risk weights are a prototype choice checked against past data, not scientific coefficients.
- The Forecast MVP is tuned for one corridor: Lima to Huancayo on the Carretera Central (PE-22).
- News reports stay unverified until an agency confirms them.

## Vision

From one route check to supply-chain continuity: live fleet monitoring, alerts, GPS and fleet-platform integrations, scenario planning for public risk teams, and nationwide coverage.
