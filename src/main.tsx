import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BUDGETS,
  CHAPTERS,
  CLUES,
  ITEMS,
  LOCATIONS,
  ORIGINS,
  RECIPES,
  type Item,
  type LocationId,
} from "../shared/content";
import type { Action, PublicRoom, PublicPlayer } from "../shared/types";
import "./style.css";
const ENDPOINT = "/.netlify/functions/game";
const seat =
  new URLSearchParams(location.search)
    .get("seat")
    ?.replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 40) || "default";
const sessionKey = "halloweekend-session:" + seat;
const newRequestId = () => {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("");
  return (
    h.slice(0, 8) +
    "-" +
    h.slice(8, 12) +
    "-" +
    h.slice(12, 16) +
    "-" +
    h.slice(16, 20) +
    "-" +
    h.slice(20)
  );
};
const freshToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
type Session = { token: string; code: string; playerId: string };
function readSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(sessionKey) || "null");
  } catch {
    return null;
  }
}
function Skyline() {
  return (
    <svg className="skyline" viewBox="0 0 1000 440" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stopColor="#272035" />
          <stop offset="1" stopColor="#100e16" />
        </linearGradient>
        <radialGradient id="moon">
          <stop stopColor="#f4d9b1" />
          <stop offset="1" stopColor="#b99c91" />
        </radialGradient>
      </defs>
      <rect width="1000" height="440" fill="url(#sky)" />
      <circle cx="710" cy="103" r="62" fill="url(#moon)" opacity=".85" />
      <path d="M0 295Q140 230 270 290T560 260T1000 290V440H0Z" fill="#211c2c" />
      <g fill="#100e17" stroke="#493a46" strokeWidth="2">
        <path d="M187 413V288L240 236L291 288V413M252 413V246H388V413M362 413V229L424 185L483 229V413M480 413V245H658V413M639 413V285L702 235L762 285V413" />
        <path d="M403 413V165H395L426 109L457 165H449V413M408 167V111L426 73L443 111V167M423 76V38" />
        <path d="M167 413V316H187M763 413V318H797V413" />
      </g>
      <g fill="#b57343" opacity=".7">
        {[213, 265, 310, 340, 370, 468, 500, 535, 570, 610, 665, 710, 741].map(
          (x) => (
            <React.Fragment key={x}>
              <path d={`M${x} 320v-20q7-15 14 0v20z`} />
              <path d={`M${x} 365v-20q7-15 14 0v20z`} />
            </React.Fragment>
          ),
        )}
      </g>
      <circle cx="426" cy="192" r="14" fill="#dfc7a6" />
      <path
        d="M426 181V192L434 197"
        fill="none"
        stroke="#17111e"
        strokeWidth="3"
      />
      <g fill="#0a0910">
        <path d="M47 440L64 201L41 156L61 177L64 110L76 188L103 148L81 208L89 440ZM875 440L888 212L852 162L887 186L892 112L904 183L949 147L910 211L922 440" />
        <path d="M0 410Q240 387 480 412T1000 404V440H0Z" />
      </g>
    </svg>
  );
}
function App() {
  const [session, setSession] = useState<Session | null>(readSession);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [name, setName] = useState(
    localStorage.getItem("halloweekend-name") || "",
  );
  const [code, setCode] = useState("");
  const [join, setJoin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  const [tab, setTab] = useState<"map" | "pack" | "craft" | "journal">("map");
  const [now, setNow] = useState(Date.now());
  const [connected, setConnected] = useState(true);
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const [chapter, setChapter] = useState<number | null>(null);
  const lastNight = useRef(0);
  const live = useRef(room);
  live.current = room;
  const accept = useCallback((r: PublicRoom) => {
    setRoom((old) =>
      !old || old.code !== r.code || r.version >= old.version ? r : old,
    );
  }, []);
  const request = async (body: Record<string, unknown>, token: string) => {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => ({
      error:
        response.status === 429
          ? "Too many requests. Wait a moment and try again."
          : "The server returned an unexpected response.",
    }));
    if (!response.ok)
      throw Object.assign(new Error(data.error || "Connection interrupted."), {
        status: response.status,
      });
    return data as { room: PublicRoom; playerId: string };
  };
  useEffect(() => {
    if (!session) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await request(
          { op: "state", code: session.code },
          session.token,
        );
        if (!stopped) {
          accept(data.room);
          setConnected(true);
        }
      } catch (e) {
        if (!stopped) {
          setConnected(false);
          setError((e as Error).message);
        }
      } finally {
        if (!stopped) timer = setTimeout(poll, document.hidden ? 10000 : 2000);
      }
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [session, accept]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (room?.phase === "playing" && room.night !== lastNight.current) {
      setChapter(room.night);
      lastNight.current = room.night;
    }
  }, [room?.night, room?.phase]);
  async function send(
    body: Record<string, unknown>,
    existing?: Record<string, unknown>,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    const token =
      session?.token ||
      localStorage.getItem("halloweekend-token:" + seat) ||
      freshToken();
    localStorage.setItem("halloweekend-token:" + seat, token);
    const payload = existing || {
      ...body,
      requestId: newRequestId(),
      ...(session ? { code: session.code } : {}),
    };
    try {
      const data = await request(payload, token);
      accept(data.room);
      if (!session) {
        const s = { token, code: data.room.code, playerId: data.playerId };
        localStorage.setItem(sessionKey, JSON.stringify(s));
        localStorage.setItem("halloweekend-name", name);
        setSession(s);
      }
      setPending(null);
      setConnected(true);
    } catch (e) {
      setError((e as Error).message);
      if (
        !(e as { status?: number }).status ||
        (e as { status: number }).status >= 500
      )
        setPending(payload);
    } finally {
      setBusy(false);
    }
  }
  const action = (a: Action) =>
    send({ op: "action", action: a, round: room?.totalRound, run: room?.run });
  const me = room?.players.find((p) => p.id === session?.playerId);
  const canAct =
    !!me &&
    me.status === "alive" &&
    !me.acted &&
    !busy &&
    !pending &&
    connected;
  function leave() {
    localStorage.removeItem(sessionKey);
    setSession(null);
    setRoom(null);
    setPending(null);
    setError("");
    lastNight.current = 0;
  }
  const header = (
    <header className="topbar">
      <a
        className="wordmark"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setHelp(true);
        }}
      >
        <span className="seal">D</span>
        <span>
          DEPAUW<span className="wordmark-sub">THE LAST HALLOWEEKEND</span>
        </span>
      </a>
      <div className="header-right">
        {room && (
          <span className={"connection " + (!connected ? "offline" : "")}>
            <i />
            {connected ? "LIVE" : "RECONNECTING"}
          </span>
        )}
        <button className="quiet" onClick={() => setHelp(true)}>
          How to play <span>↗</span>
        </button>
      </div>
    </header>
  );
  return (
    <>
      {header}
      {!session ? (
        <main className="landing">
          <div className="hero-art">
            <Skyline />
            <div className="coordinates">
              39.6400° N / 86.8616° W<span>GREENCASTLE, INDIANA</span>
            </div>
          </div>
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-line" /> A COOPERATIVE CAMPUS HORROR STORY
            </div>
            <h1>
              THE LAST
              <br />
              <em>HALLOWEEKEND</em>
            </h1>
            <p className="tagline">
              Three nights. One campus.
              <br />
              <span>Make it out together.</span>
            </p>
            <div className="hero-meta">
              <span>2–8 SURVIVORS</span>
              <span>THREE CHAPTERS</span>
              <span>ONE SHARED WORLD</span>
            </div>
          </div>
          <section className="entry-card">
            <div className="card-heading">
              <span className="eyebrow">YOUR STORY BEGINS</span>
              <span className="orange">01 / 03</span>
            </div>
            <h2>
              Find your people.
              <br />
              Then find a way out.
            </h2>
            <label htmlFor="nickname">SURVIVOR NAME</label>
            <input
              id="nickname"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              autoComplete="nickname"
            />
            {join && (
              <>
                <label htmlFor="roomcode">ROOM CODE</label>
                <input
                  id="roomcode"
                  value={code}
                  maxLength={6}
                  onChange={(e) =>
                    setCode(
                      e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""),
                    )
                  }
                  placeholder="ABC234"
                />
              </>
            )}
            <button
              className="primary wide"
              disabled={busy || !name.trim() || (join && code.length !== 6)}
              onClick={() =>
                send({
                  op: join ? "join" : "create",
                  name: name.trim(),
                  ...(join ? { code } : {}),
                })
              }
            >
              {busy
                ? "Connecting…"
                : join
                  ? "Join the survivors →"
                  : "Create a room →"}
            </button>
            <button className="secondary wide" onClick={() => setJoin(!join)}>
              {join ? "Create a new room instead" : "Have a code? Join a room"}
            </button>
            <p className="micro">
              No accounts. Share a code. Survive together.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
                {pending && (
                  <button onClick={() => send({}, pending)}>
                    Retry same request
                  </button>
                )}
              </p>
            )}
          </section>
          <div className="opening-strip">
            <span className="alert-icon">!</span>
            <div>
              <b>11:47 PM · OCTOBER 29, 2026</b>
              <p>
                Your phone vibrates. “Campus lockdown in effect. Avoid East
                College.”
                <br />
                Then the lights go out.
              </p>
            </div>
            <span className="fiction-label">
              A FICTIONAL HALLOWEEN ADVENTURE
              <br />
              NOT AN ACTUAL CAMPUS ALERT
            </span>
          </div>
        </main>
      ) : !room || !me ? (
        <main className="loading">
          <h1>Finding your survivors…</h1>
          <p>{error || "Reconnecting to your room."}</p>
          <button onClick={leave}>Return to title</button>
        </main>
      ) : room.phase === "lobby" ? (
        <main className="lobby">
          <div className="eyebrow">THE CALM BEFORE THE LOCKDOWN</div>
          <h1>
            DON’T GO
            <br />
            <em>ALONE.</em>
          </h1>
          <p>
            Send this room code to your friends. Everyone opens this same
            website on their own device.
          </p>
          <div className="code-card">
            <span>ROOM CODE</span>
            <strong>{room.code}</strong>
            <button
              onClick={() => {
                navigator.clipboard
                  ?.writeText(room.code)
                  .catch(() => setError("Copy the code above manually."));
              }}
            >
              Copy code
            </button>
          </div>
          <div className="lobby-grid">
            {room.players.map((p, i) => (
              <article className="survivor-card" key={p.id}>
                <span className="avatar">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>
                    {p.name} {p.id === me.id && <small>(you)</small>}
                  </h3>
                  <p>
                    {p.id === room.host ? "ROOM HOST" : "SURVIVOR"} ·{" "}
                    {now - p.lastSeen < 45000 ? "CONNECTED" : "AWAY"}
                  </p>
                </div>
                <span className="status-dot" />
              </article>
            ))}
            {room.players.length < 8 && (
              <article className="survivor-card empty">
                + Waiting for survivors · {room.players.length}/8
              </article>
            )}
          </div>
          <div className="lobby-bottom">
            <p>
              Normal difficulty · 40 / 40 / 36 shared rounds
              <br />
              Your first objective: reach Hoover Hall and secure a safehouse.
            </p>
            <button
              className="primary"
              disabled={busy || room.players.length < 2 || me.id !== room.host}
              onClick={() => send({ op: "start" })}
            >
              {me.id !== room.host
                ? "Waiting for the host"
                : room.players.length < 2
                  ? "Waiting for a second survivor"
                  : "Begin the lockdown →"}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="lobby-links">
            <button className="quiet" onClick={leave}>
              Return to title
            </button>
            <a
              className="quiet"
              href={"?seat=" + newRequestId()}
              target="_blank"
              rel="noreferrer"
            >
              Open a separate survivor session ↗
            </a>
          </div>
        </main>
      ) : (
        <main className="game">
          <section className="campaign-bar">
            <div>
              <div className="eyebrow">
                NIGHT {room.night} / 3 · {room.code}
              </div>
              <h1>{CHAPTERS[room.night]}</h1>
            </div>
            <div className="clock">
              <b>
                {Math.max(0, BUDGETS[room.night] - room.round)}{" "}
                <small>ROUNDS LEFT</small>
              </b>
              <span>10 in-game minutes per round</span>
            </div>
            <div className="round-status">
              <span>
                {room.players.filter((p) => p.acted).length} /{" "}
                {room.players.filter((p) => p.status === "alive").length} turns
                ended
              </span>
              <b>
                {me.acted
                  ? "Waiting for your team"
                  : me.status === "alive"
                    ? "Your move"
                    : me.status.toUpperCase()}
              </b>
              <small>
                {Math.max(0, Math.ceil((room.deadline - now) / 1000))}s turn
                window
              </small>
            </div>
          </section>
          {error && (
            <div className="error" role="alert">
              {error}
              {pending && (
                <button onClick={() => send({}, pending)}>
                  Retry same request
                </button>
              )}
              <button className="quiet" onClick={() => setError("")}>
                Dismiss
              </button>
            </div>
          )}
          {room.phase === "victory" || room.phase === "defeat" ? (
            <Scoreboard
              room={room}
              me={me}
              busy={busy}
              again={() => send({ op: "again" })}
              leave={leave}
            />
          ) : (
            <>
              <div className="game-layout">
                <aside className="left-column">
                  <section className="panel objective-panel">
                    <div className="panel-label">
                      THE PLAN <span>0{room.night}</span>
                    </div>
                    <h2>
                      {room.night === 1
                        ? "A place to survive."
                        : room.night === 2
                          ? "Find the source."
                          : "Before the last bell."}
                    </h2>
                    <Objectives room={room} />
                    <p className="micro">
                      {room.night === 1
                        ? "Finish all objectives to shelter until Night 2."
                        : room.night === 2
                          ? "The three clues unlock the transmitter recipe."
                          : "The first escape secures victory. Keep playing to bring everyone home."}
                    </p>
                  </section>
                  <section className="panel">
                    <div className="panel-label">
                      YOUR SURVIVOR <span>{me.score} PTS</span>
                    </div>
                    <h3>{me.name}</h3>
                    <Stat
                      label="Health"
                      value={me.health}
                      color="red"
                      hint="Zero health incapacitates you. A teammate has three shared rounds to revive you."
                    />
                    <Stat
                      label="Hunger"
                      value={me.hunger}
                      color="orange"
                      hint="Drops 2 each round. Eat to restore 38. Starvation costs 6 health per round."
                    />
                    <Stat
                      label="Stamina"
                      value={me.stamina}
                      color="purple"
                      hint="Attacks cost 10; sprint or flee costs 12. Rest restores 30."
                    />
                    <div className="noise">
                      <span>NOISE</span>
                      <b>{me.noise} / 100</b>
                    </div>
                    <p className="micro">
                      Noise increases attack damage by 2 per 40 points. It fades
                      6 per round.
                    </p>
                  </section>
                  <section className="panel">
                    <div className="panel-label">
                      YOUR PEOPLE <span>{room.players.length}</span>
                    </div>
                    {room.players.map((p, i) => (
                      <div className="team-row" key={p.id}>
                        <span className={"team-dot color-" + i} />
                        <div>
                          <b>{p.name}</b>
                          <small>
                            {LOCATIONS[p.location].short} ·{" "}
                            {p.status === "alive"
                              ? p.acted
                                ? "turn ended"
                                : "choosing"
                              : p.status}
                          </small>
                        </div>
                        <span>
                          {p.health}
                          <small>HP</small>
                        </span>
                      </div>
                    ))}
                  </section>
                </aside>
                <div className="main-column">
                  <section className="location-panel">
                    <div className="eyebrow">
                      YOU ARE HERE{" "}
                      <span className="location-risk">
                        {LOCATIONS[me.location].risk}
                      </span>
                    </div>
                    <h2>{LOCATIONS[me.location].name}</h2>
                    <p>{LOCATIONS[me.location].description}</p>
                    <div className="hint">↳ {LOCATIONS[me.location].hint}</div>
                    {room.enemies
                      .filter((e) => e.health > 0 && e.location === me.location)
                      .map((e) => (
                        <div className="enemy" key={e.id}>
                          <div>
                            <b>⚠ {e.type}</b>
                            <span>
                              {e.health} / {e.maxHealth} HP ·{" "}
                              {e.distractedUntil >= room.totalRound
                                ? "DISTRACTED"
                                : rBossSafe(room, me)
                                  ? "BYPASSED"
                                  : "HOSTILE"}
                            </span>
                          </div>
                          <div className="enemy-buttons">
                            <button
                              disabled={!canAct}
                              onClick={() =>
                                action({ type: "attack", target: e.id })
                              }
                            >
                              Attack
                            </button>
                            <button
                              disabled={!canAct}
                              onClick={() => action({ type: "defend" })}
                            >
                              Defend
                            </button>
                            <button
                              disabled={!canAct || !me.inventory.decoy}
                              onClick={() => action({ type: "distract" })}
                            >
                              Distract
                            </button>
                          </div>
                        </div>
                      ))}
                    {me.status !== "alive" && (
                      <div className="notice">
                        {me.status === "down"
                          ? `You are incapacitated. A co-located teammate needs a first-aid kit. ${Math.max(0, 3 - (room.totalRound - (me.downRound || 0)))} rounds remain.`
                          : me.status === "escaped"
                            ? "You are aboard the rescue vehicle. Follow your team’s progress below."
                            : "You are spectating. Your supplies were left where you fell."}
                      </div>
                    )}
                    <div className="quick-actions">
                      <button
                        disabled={!canAct}
                        onClick={() => action({ type: "rest" })}
                      >
                        Rest <small>+30 stamina</small>
                      </button>
                      <button
                        disabled={!canAct || !me.inventory.ration}
                        onClick={() => action({ type: "eat" })}
                      >
                        Eat <small>+38 hunger</small>
                      </button>
                      <button
                        disabled={!canAct}
                        onClick={() => action({ type: "wait" })}
                      >
                        End turn <small>Keep watch</small>
                      </button>
                      {room.night >= 2 &&
                        (me.location === "julian" ||
                          me.location === "library") && (
                          <button
                            disabled={!canAct}
                            onClick={() => action({ type: "investigate" })}
                          >
                            Investigate
                          </button>
                        )}
                      {room.night >= 2 &&
                        me.location === "lilly" &&
                        !room.npcRescued && (
                          <button
                            disabled={!canAct}
                            onClick={() => action({ type: "rescue" })}
                          >
                            Rescue Sam
                          </button>
                        )}
                      {room.night === 3 && me.location === "east" && (
                        <>
                          <button
                            disabled={!canAct || room.bossBypassed}
                            onClick={() => action({ type: "bypass" })}
                          >
                            Service stairs
                          </button>
                          <button
                            className="primary"
                            disabled={!canAct || room.signal}
                            onClick={() => action({ type: "signal" })}
                          >
                            Send rescue signal
                          </button>
                        </>
                      )}
                      {room.signal && me.location === "nature" && (
                        <button
                          className="primary"
                          disabled={!canAct}
                          onClick={() => action({ type: "escape" })}
                        >
                          Board evacuation
                        </button>
                      )}
                      {room.players
                        .filter(
                          (p) =>
                            p.status === "down" && p.location === me.location,
                        )
                        .map((p) => (
                          <button
                            key={p.id}
                            disabled={!canAct || !me.inventory.medkit}
                            onClick={() =>
                              action({ type: "revive", target: p.id })
                            }
                          >
                            Revive {p.name}
                          </button>
                        ))}
                    </div>
                    <p className="micro turn-tip">
                      Every action ends your turn. Plan together before moving.
                    </p>
                  </section>
                  <div className="tabs" role="tablist" aria-label="Field tools">
                    {(["map", "pack", "craft", "journal"] as const).map((t) => (
                      <button
                        role="tab"
                        aria-selected={tab === t}
                        key={t}
                        className={tab === t ? "selected" : ""}
                        onClick={() => setTab(t)}
                      >
                        {t === "map"
                          ? "Campus map"
                          : t === "pack"
                            ? "Supplies"
                            : t === "craft"
                              ? "Crafting"
                              : "Field notes"}
                      </button>
                    ))}
                  </div>
                  <section className="panel tool-panel">
                    {tab === "map" ? (
                      <>
                        <CampusMap
                          room={room}
                          me={me}
                          enabled={canAct}
                          move={(target) => action({ type: "move", target })}
                        />
                        <div className="destinations">
                          <div className="panel-label">
                            CONNECTED DESTINATIONS
                          </div>
                          {LOCATIONS[me.location].links.map((id) => (
                            <div className="destination" key={id}>
                              <span>{LOCATIONS[id].name}</span>
                              <div>
                                <button
                                  disabled={!canAct}
                                  onClick={() =>
                                    action({ type: "move", target: id })
                                  }
                                >
                                  Walk →
                                </button>
                                <button
                                  disabled={!canAct || me.stamina < 12}
                                  onClick={() =>
                                    action({ type: "flee", target: id })
                                  }
                                >
                                  Flee
                                </button>
                                <button
                                  disabled={!canAct || me.stamina < 12}
                                  onClick={() =>
                                    action({ type: "sprint", target: id })
                                  }
                                >
                                  Sprint
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : tab === "pack" ? (
                      <Supplies
                        room={room}
                        me={me}
                        enabled={canAct}
                        action={action}
                      />
                    ) : tab === "craft" ? (
                      <>
                        <div className="panel-label">
                          MAKE SOMETHING USEFUL <span>6 RECIPES</span>
                        </div>
                        <div className="recipes">
                          {Object.entries(RECIPES).map(([id, r]) => (
                            <article key={id}>
                              <h3>{r.name}</h3>
                              <p>
                                {Object.entries(r.needs)
                                  .map(
                                    ([i, n]) => `${n} ${ITEMS[i as Item].name}`,
                                  )
                                  .join(" + ")}
                              </p>
                              <small>
                                {r.gives
                                  ? ITEMS[r.gives].description
                                  : "Build at the Memorial Union. Secures the safehouse."}
                              </small>
                              <button
                                disabled={
                                  !canAct ||
                                  Object.entries(r.needs).some(
                                    ([i, n]) =>
                                      (me.inventory[i as Item] || 0) < n!,
                                  ) ||
                                  (id === "transmitter" &&
                                    room.clues.length < 3) ||
                                  (id === "barricade" &&
                                    (me.location !== "union" || room.barricade))
                                }
                                onClick={() =>
                                  action({ type: "craft", target: id })
                                }
                              >
                                Craft {r.name}
                              </button>
                            </article>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="panel-label">
                          THE RESEARCH <span>{room.clues.length}/3</span>
                        </div>
                        {CLUES.map((c) => (
                          <article className="clue" key={c.id}>
                            <span>
                              {room.clues.includes(c.id)
                                ? "RECOVERED"
                                : "UNDISCOVERED"}{" "}
                              · {LOCATIONS[c.at as LocationId].name}
                            </span>
                            <h3>
                              {room.clues.includes(c.id)
                                ? c.title
                                : "An unread record"}
                            </h3>
                            <p>
                              {room.clues.includes(c.id)
                                ? c.text
                                : "Investigate this location during Night 2."}
                            </p>
                          </article>
                        ))}
                        <p>
                          Optional rescue:{" "}
                          {room.npcRescued
                            ? "Sam is safe."
                            : "A student is trapped at Lilly Center."}
                        </p>
                      </>
                    )}
                  </section>
                </div>
                <aside className="right-column">
                  <section className="panel event-panel">
                    <div className="panel-label">
                      LIVE FROM CAMPUS <span className="live-dot" />
                    </div>
                    <h2>The story so far.</h2>
                    <div
                      className="events"
                      aria-live="polite"
                      aria-relevant="additions"
                    >
                      {[...room.events]
                        .reverse()
                        .slice(0, 35)
                        .map((event, i) => (
                          <article
                            key={event.id}
                            className={i === 0 ? "latest" : ""}
                          >
                            <span>
                              N{event.night} · ROUND {event.round + 1}
                            </span>
                            <p>{event.text}</p>
                          </article>
                        ))}
                    </div>
                  </section>
                </aside>
              </div>
            </>
          )}
        </main>
      )}
      {help && <Help close={() => setHelp(false)} />}{" "}
      {chapter && room?.phase === "playing" && (
        <div className="modal-backdrop">
          <section
            className="modal chapter"
            role="dialog"
            aria-modal="true"
            aria-label="New chapter"
          >
            <div className="eyebrow">
              OCTOBER {chapter === 1 ? "29" : chapter === 2 ? "30" : "31"}, 2026
            </div>
            <span className="chapter-number">0{chapter}</span>
            <h2>{CHAPTERS[chapter]}</h2>
            <p>
              {chapter === 1
                ? "Your phone vibrates. Campus lockdown in effect. Avoid East College. From Humbert Hall, you see something following a student across Ubben Quad. Then the lights go out."
                : chapter === 2
                  ? "The barricade holds through daylight. At dusk, the bell starts again. Follow the trail to Julian Science Center and Roy O. West Library."
                  : "The transmitter is ready. The Bellkeeper waits beneath East College. A clever distraction may accomplish what brute force cannot."}
            </p>
            <p className="micro">
              {BUDGETS[chapter]} shared rounds · approximately{" "}
              {BUDGETS[chapter] * 10} in-game minutes
            </p>
            <button
              autoFocus
              className="primary"
              onClick={() => setChapter(null)}
            >
              Enter the night →
            </button>
          </section>
        </div>
      )}
      <footer>
        <span>DEPAUW: THE LAST HALLOWEEKEND</span>
        <span>Fictional events. Unofficial student-inspired game.</span>
        <button className="quiet" onClick={() => setHelp(true)}>
          Rules & credits
        </button>
      </footer>
    </>
  );
}
function rBossSafe(r: PublicRoom, p: PublicPlayer) {
  return p.location === "east" && (r.bossBypassed || r.signal);
}
function Stat({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: number;
  color: string;
  hint: string;
}) {
  return (
    <div className={"stat " + color} title={hint}>
      <div>
        <span>{label}</span>
        <b>
          {value}
          <small>/100</small>
        </b>
      </div>
      <progress max="100" value={value} aria-label={label} />
    </div>
  );
}
function Objectives({ room: r }: { room: PublicRoom }) {
  const list =
    r.night === 1
      ? [
          [
            "Reach Hoover Hall",
            r.players.some((p) => p.visited.includes("hoover")),
          ],
          [`Collect pantry rations (${r.foodFound}/6)`, r.foodFound >= 6],
          ["Barricade Memorial Student Union", r.barricade],
        ]
      : r.night === 2
        ? [
            ["Investigate Julian Science Center", r.clues.includes("waveform")],
            [
              `Recover research clues (${r.clues.length}/3)`,
              r.clues.length === 3,
            ],
            ["Craft the emergency transmitter", r.transmitterBuilt],
          ]
        : [
            ["Send the signal at East College", r.signal],
            [
              "Escape through the Nature Park",
              r.players.some((p) => p.status === "escaped"),
            ],
          ];
  return (
    <ul className="objectives">
      {list.map(([text, done]) => (
        <li key={String(text)} className={done ? "done" : ""}>
          <span>{done ? "✓" : "○"}</span>
          {text}
        </li>
      ))}
    </ul>
  );
}
function CampusMap({
  room,
  me,
  enabled,
  move,
}: {
  room: PublicRoom;
  me: PublicPlayer;
  enabled: boolean;
  move: (id: LocationId) => void;
}) {
  const edges = Object.entries(LOCATIONS).flatMap(([id, l]) =>
    l.links.filter((to) => id < to).map((to) => [id as LocationId, to]),
  );
  return (
    <>
      <div className="map-top">
        <span>CAMPUS FIELD MAP</span>
        <span>N ↑</span>
      </div>
      <div className="campus-map">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M22 0V100M0 47H100M0 73H100M91 0V100"
            stroke="#34303b"
            strokeWidth=".3"
            fill="none"
          />
          {edges.map(([a, b]) => (
            <line
              key={a + b}
              x1={LOCATIONS[a].x}
              y1={LOCATIONS[a].y}
              x2={LOCATIONS[b].x}
              y2={LOCATIONS[b].y}
              stroke={
                a === me.location || b === me.location ? "#9d643d" : "#4b414e"
              }
              strokeWidth=".45"
              strokeDasharray={a === "nature" || b === "nature" ? "1 1" : ""}
            />
          ))}
        </svg>
        {Object.entries(LOCATIONS).map(([id, l]) => {
          const here = me.location === id,
            adjacent = LOCATIONS[me.location].links.includes(id as LocationId),
            visited = room.players.some((p) =>
              p.visited.includes(id as LocationId),
            );
          return (
            <button
              key={id}
              className={
                "map-node " +
                (here ? "here " : adjacent ? "adjacent " : "") +
                (visited ? "visited" : "unvisited")
              }
              style={{ left: l.x + "%", top: l.y + "%" }}
              disabled={!enabled || !adjacent}
              onClick={() => move(id as LocationId)}
              aria-label={"Move to " + l.name}
              title={
                l.name +
                (adjacent ? " · connected" : " · not directly connected")
              }
            >
              <span className="node-symbol">
                {here ? "◆" : id === "nature" ? "♧" : "◇"}
              </span>
              <span className="node-label">{l.short}</span>
              <span className="map-players">
                {room.players
                  .filter((p) => p.location === id && p.status !== "spectator")
                  .map((p) => (
                    <i key={p.id} title={p.name} />
                  ))}
              </span>
            </button>
          );
        })}
        <span className="map-caption">
          NATURE PARK: WESTERN TRAIL
          <br />
          SCHEMATIC · NOT TO SCALE
        </span>
      </div>
      <div className="map-legend">
        <span>
          <i className="orange-dot" /> You are here
        </span>
        <span>
          <i /> Visited
        </span>
        <span>◇ Unexplored</span>
        <span>Click a connected location to walk</span>
      </div>
    </>
  );
}
function Supplies({
  room,
  me,
  enabled,
  action,
}: {
  room: PublicRoom;
  me: PublicPlayer;
  enabled: boolean;
  action: (a: Action) => void;
}) {
  const [recipient, setRecipient] = useState("");
  const others = room.players.filter(
    (p) => p.id !== me.id && p.status === "alive" && p.location === me.location,
  );
  const loot = { ...room.loot[me.location] };
  for (const [i, n] of Object.entries(room.ground[me.location]))
    loot[i as Item] = (loot[i as Item] || 0) + n!;
  return (
    <>
      <div className="panel-label">
        YOUR BACKPACK <span>{Object.keys(me.inventory).length} / 6 SLOTS</span>
      </div>
      <p className="micro">
        Each item type uses one slot; stacks hold up to 24. ★ Essential items
        remain on the ground when dropped.
      </p>
      {others.length > 0 && (
        <label className="trade-select">
          Trade with{" "}
          <select
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          >
            <option value="">Choose teammate</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="item-list">
        {Object.entries(me.inventory).map(([key, n]) => {
          const i = key as Item;
          return (
            <article key={i}>
              <div>
                <b>
                  {ITEMS[i].essential ? "★ " : ""}
                  {ITEMS[i].name} <span>×{n}</span>
                </b>
                <small>{ITEMS[i].description}</small>
              </div>
              <div className="item-actions">
                {(i === "bandages" || i === "medkit") && (
                  <button
                    disabled={!enabled || me.health === 100}
                    onClick={() => action({ type: "heal", item: i })}
                  >
                    Use
                  </button>
                )}
                {i === "ration" && (
                  <button
                    disabled={!enabled}
                    onClick={() => action({ type: "eat" })}
                  >
                    Eat
                  </button>
                )}
                <button
                  disabled={!enabled}
                  onClick={() => action({ type: "drop", item: i })}
                >
                  Drop 1
                </button>
                {others.length > 0 && (
                  <button
                    disabled={!enabled || !recipient}
                    onClick={() =>
                      action({ type: "trade", item: i, target: recipient })
                    }
                  >
                    Give 1
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <div className="panel-label supplies-label">
        AVAILABLE HERE <span>SHARED WITH EVERYONE</span>
      </div>
      <div className="item-list">
        {Object.entries(loot)
          .filter(([, n]) => n! > 0)
          .map(([key, n]) => {
            const i = key as Item;
            return (
              <article key={i}>
                <div>
                  <b>
                    {ITEMS[i].essential ? "★ " : ""}
                    {ITEMS[i].name} <span>×{n}</span>
                  </b>
                  <small>{ITEMS[i].description}</small>
                </div>
                <div className="item-actions">
                  <button
                    disabled={!enabled}
                    onClick={() => action({ type: "take", item: i })}
                  >
                    Take 1
                  </button>
                  {n! >= 3 && (
                    <button
                      disabled={!enabled}
                      onClick={() =>
                        action({ type: "take", item: i, quantity: 3 })
                      }
                    >
                      Take 3
                    </button>
                  )}
                </div>
              </article>
            );
          })}
      </div>
      <details className="recovery">
        <summary>Essential item recovery</summary>
        <p className="micro">
          Lost items remain in shared ground loot. These reserves open only when
          no copy remains anywhere. Craft the first transmitter normally.
        </p>
        {Object.entries(ORIGINS)
          .filter(([, l]) => l === me.location)
          .map(([i]) => (
            <button
              key={i}
              disabled={!enabled}
              onClick={() => action({ type: "recover", item: i as Item })}
            >
              Recover {ITEMS[i as Item].name}
            </button>
          ))}
      </details>
    </>
  );
}
function Scoreboard({
  room,
  me,
  busy,
  again,
  leave,
}: {
  room: PublicRoom;
  me: PublicPlayer;
  busy: boolean;
  again: () => void;
  leave: () => void;
}) {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  return (
    <section className="scoreboard panel">
      <div className="eyebrow">THE MORNING AFTER</div>
      <h1>
        {room.phase === "victory"
          ? room.perfect
            ? "PERFECT VICTORY"
            : "YOU MADE IT."
          : "THE CAMPUS FELL."}
      </h1>
      <p>{room.reason}</p>
      <div className="champion">
        ULTIMATE SURVIVOR{" "}
        <strong>
          {sorted
            .filter((p) => p.score === sorted[0].score)
            .map((p) => p.name)
            .join(" & ")}
        </strong>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Survivor</th>
              <th>Status</th>
              <th>Score</th>
              <th>Zombies</th>
              <th>Crafted</th>
              <th>Rescues</th>
              <th>Nights</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>
                  {p.status === "escaped"
                    ? "Escaped"
                    : p.status === "alive"
                      ? "Stranded"
                      : p.status}
                </td>
                <td>{p.score}</td>
                <td>{p.kills}</td>
                <td>{p.crafted}</td>
                <td>{p.rescues}</td>
                <td>{p.nights}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="primary"
        disabled={busy || me.id !== room.host}
        onClick={again}
      >
        {me.id === room.host
          ? "Play again with this team →"
          : "Waiting for host to play again"}
      </button>
      <button className="quiet" onClick={leave}>
        Return to title
      </button>
    </section>
  );
}
function Help({ close }: { close: () => void }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, [close]);
  return (
    <div className="modal-backdrop">
      <section
        className="modal help"
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
      >
        <button
          autoFocus
          className="close"
          onClick={close}
          aria-label="Close instructions"
        >
          ×
        </button>
        <div className="eyebrow">A SURVIVOR’S FIELD GUIDE</div>
        <h2>
          Stay together.
          <br />
          Stay alive.
        </h2>
        <h3>Join your team</h3>
        <p>
          Create a room, share its six-character code and this website’s URL,
          and have 2–8 players join with distinct nicknames. The host starts.
          Your browser remembers your session after refresh. Do not clear
          browser storage during a campaign. For a second player on the same
          device, use “Open a separate survivor session” in the lobby, or
          another browser profile.
        </p>
        <h3>One action. One shared round.</h3>
        <p>
          Every successful action ends your turn: movement, collecting, trading,
          crafting, eating, using medicine, or combat. “End turn” passes.
          Invalid actions cost nothing. A round resolves after every living
          player acts. Once someone acts, a 90-second deadline lets absent
          players automatically pass. With nobody connected, time pauses. A
          returning player rejoins the same shared state. Menus and reading cost
          no turns.
        </p>
        <p>
          Each round is about ten in-game minutes. Night 1 starts Thursday,
          October 29, 2026 at 11:47 PM; its 40-round budget ends at 6:27 AM.
          Night 2 has 40 rounds; Night 3 has 36. Later nights begin at 11:47 PM
          after a daylight shelter transition. Complete objectives before the
          last round expires. The clock shows the remaining action budget.
        </p>
        <h3>Survive the three nights</h3>
        <ol>
          <li>
            <b>The Lockdown:</b> reach Hoover, collect six fresh pantry rations
            collectively, and craft a barricade at the Memorial Union.
          </li>
          <li>
            <b>The Infection:</b> investigate Julian, read two library records,
            and craft the transmitter. The second library record requires
            Julian’s log. Optionally rescue Sam at Lilly after clearing or
            distracting its enemy.
          </li>
          <li>
            <b>The Last Bell:</b> reach East College. Defeat the Bellkeeper or
            distract it with a decoy, then use the service stairs. Activate the
            transmitter and reach the Nature Park via Lilly. Use “Board
            evacuation” before sunrise.
          </li>
        </ol>
        <p>
          The first escape secures team victory, but play continues until all
          remaining players are out, eliminated, or the clock expires. All
          escaped players share victory. A Perfect Victory requires every
          original survivor to escape and Sam to be rescued. If nobody escapes
          before the deadline, or nobody can act or rescue teammates, the team
          loses.
        </p>
        <h3>Stats and combat</h3>
        <p>
          Health starts at 100. At zero, you are incapacitated; a co-located
          teammate has three shared rounds to use a first-aid kit on you.
          Otherwise you spectate and leave your supplies on the ground. Hunger
          starts at 100, drops 2 per round, and costs 6 health each round at
          zero. Rations restore 38 hunger. Stamina starts at 100; rest restores
          30.
        </p>
        <p>
          Attack costs 10 stamina and deals 12 damage, or 28 with a bat. A
          Wanderer has 35 health and deals 8 damage; a Runner has 55 and deals
          12; the Bellkeeper has 180 and deals 22. Enemies at your location
          retaliate after your accepted action. Defend restores 6 stamina and
          blocks 12 damage. A shield passively blocks 4 more. Bandages heal 15;
          kits heal 45 or revive to 40.
        </p>
        <p>
          Sprint and flee cost 12 stamina and block 12 retaliation damage during
          that move. A Runner follows ordinary walking, but cannot keep up with
          sprinting or fleeing. Entering the Nature Park costs another 12
          stamina for the longer trail. Distracting with a reusable decoy
          prevents retaliation for the current round and next round. Have a
          teammate use the service stairs while the Bellkeeper is distracted.
        </p>
        <p>
          Attacking raises noise by 20; sprinting or fleeing raises it by 15.
          Noise adds 2 enemy damage per 40 points and fades 6 per round.
          Entering Bowman Park with noise at 40 or higher costs 4 health on the
          wet steps. The opened service route and activated counter-frequency
          protect everyone at East College.
        </p>
        <h3>Inventory and crafting</h3>
        <p>
          Six slots hold six item types, up to 24 of each. Pick up 1–3 items per
          action. Trade one item per turn with a living co-located teammate, or
          drop one for anyone to collect. Loot is shared, so coordinate.
          Equipment works automatically. At a chapter transition, living players
          regroup at the Union, gain 20 health, restore stamina, and eat from
          shelter supplies to at least 85 hunger.
        </p>
        <ul>
          {Object.entries(RECIPES).map(([id, r]) => (
            <li key={id}>
              <b>{r.name}:</b>{" "}
              {Object.entries(r.needs)
                .map(([i]) => ITEMS[i as Item].name)
                .join(" + ")}
            </li>
          ))}
        </ul>
        <p>
          ★ Essential items cannot be destroyed by dropping them. Eliminated
          players leave all items in the world. If no copy remains anywhere,
          reserve board/battery supplies are at Julian, antenna at the library,
          and planks/nails at the Union. A previously built but lost transmitter
          can be recovered at East College. Recovery and pickup each cost a
          turn.
        </p>
        <h3>Scoring</h3>
        <p>
          Discover a location: 25. Find a clue: 100. Craft a recipe: 50. Defeat
          a zombie: 30. Revive a teammate: 150. Rescue Sam: 200. Complete a
          listed night objective: 300 per eligible player. Survive all three
          nights: 500. Escape alive: 500. Discovery, recipe, teammate-revival,
          and objective awards are credited once per player per campaign;
          enemies and clues are unique. Repeating an action cannot farm points.
          The highest score earns Ultimate Survivor; ties share the title.
        </p>
        <h3>Credits and fiction</h3>
        <p>
          An unofficial Halloween adventure inspired by DePauw’s campus. All
          emergency alerts, research, characters, and outbreak events are
          fictional. The simplified walking graph is based on the{" "}
          <a
            href="https://www.depauw.edu/files/resources/dpu_campus-map_with-nature-park_1-22.pdf"
            target="_blank"
            rel="noreferrer"
          >
            official DePauw campus map
          </a>
          . Distances and routes are compressed for play; the Nature Park lies
          west of campus.
        </p>
        <button className="primary" onClick={close}>
          I’m ready →
        </button>
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
