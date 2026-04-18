/* ==========================================================================
   Exchange Schedule — static 2026 schedule for 5 major exchanges.
   Drives Wave 5 F1 (Market Open Ceremony) and E2 (exchange-specific bells).
   IANA timezone + Intl.DateTimeFormat handles DST; regenerate annually.
   ========================================================================== */
(function(){
  'use strict';

  const SCHEDULE = {
    NYSE: {
      code: "NYSE",
      name: "New York Stock Exchange",
      city: "NEW YORK",
      bellVoice: "brass",
      ianaTz: "America/New_York",
      openLocal:  { h: 9,  m: 30 },
      closeLocal: { h: 16, m: 0  },
      holidays2026: [
        "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03",
        "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07",
        "2026-11-26", "2026-12-25"
      ],
      earlyClose2026: {
        "2026-07-02": { h: 13, m: 0 },
        "2026-11-27": { h: 13, m: 0 },
        "2026-12-24": { h: 13, m: 0 }
      }
    },
    NASDAQ: {
      code: "NASDAQ",
      name: "Nasdaq Stock Market",
      city: "NEW YORK",
      bellVoice: "brass",
      ianaTz: "America/New_York",
      openLocal:  { h: 9,  m: 30 },
      closeLocal: { h: 16, m: 0  },
      holidays2026: [
        "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03",
        "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07",
        "2026-11-26", "2026-12-25"
      ],
      earlyClose2026: {
        "2026-07-02": { h: 13, m: 0 },
        "2026-11-27": { h: 13, m: 0 },
        "2026-12-24": { h: 13, m: 0 }
      }
    },
    LSE: {
      code: "LSE",
      name: "London Stock Exchange",
      city: "LONDON",
      bellVoice: "bigben",
      ianaTz: "Europe/London",
      openLocal:  { h: 8,  m: 0  },
      closeLocal: { h: 16, m: 30 },
      holidays2026: [
        "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04",
        "2026-05-25", "2026-08-31", "2026-12-25", "2026-12-28"
      ],
      earlyClose2026: {
        "2026-12-24": { h: 12, m: 30 },
        "2026-12-31": { h: 12, m: 30 }
      }
    },
    HKEX: {
      code: "HKEX",
      name: "Hong Kong Exchanges",
      city: "HONG KONG",
      bellVoice: "gong",
      ianaTz: "Asia/Hong_Kong",
      openLocal:  { h: 9,  m: 30 },
      closeLocal: { h: 16, m: 0  },
      holidays2026: [
        "2026-01-01", "2026-02-17", "2026-02-18", "2026-02-19",
        "2026-04-03", "2026-04-06", "2026-04-07", "2026-05-01",
        "2026-05-25", "2026-06-19", "2026-07-01", "2026-09-26",
        "2026-10-01", "2026-10-19", "2026-12-25", "2026-12-28"
      ],
      earlyClose2026: {}
    },
    TSE: {
      code: "TSE",
      name: "Tokyo Stock Exchange",
      city: "TOKYO",
      bellVoice: "cathedral",
      ianaTz: "Asia/Tokyo",
      openLocal:  { h: 9,  m: 0  },
      closeLocal: { h: 15, m: 0  },
      holidays2026: [
        "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-12",
        "2026-02-11", "2026-02-23", "2026-03-20", "2026-04-29",
        "2026-05-04", "2026-05-05", "2026-05-06", "2026-07-20",
        "2026-08-11", "2026-09-21", "2026-09-23", "2026-10-12",
        "2026-11-03", "2026-11-23", "2026-12-31"
      ],
      earlyClose2026: {}
    }
  };

  function ymd(date, tz) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    return parts.find(p => p.type === 'year').value + '-'
         + parts.find(p => p.type === 'month').value + '-'
         + parts.find(p => p.type === 'day').value;
  }

  function localHM(date, tz) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(date);
    const h = parseInt(parts.find(p => p.type === 'hour').value, 10) % 24;
    const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
    return { h, m };
  }

  function weekdayIndex(date, tz) {
    const wd = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'short'
    }).format(date);
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(wd);
  }

  function isTradingDay(ex, date) {
    const wi = weekdayIndex(date, ex.ianaTz);
    if (wi === 0 || wi === 6) return false;
    const key = ymd(date, ex.ianaTz);
    return !(ex.holidays2026 || []).includes(key);
  }

  function isOpenNow(code, now) {
    now = now || new Date();
    const ex = SCHEDULE[code];
    if (!ex || !isTradingDay(ex, now)) return false;
    const { h, m } = localHM(now, ex.ianaTz);
    const lmin = h * 60 + m;
    const omin = ex.openLocal.h * 60 + ex.openLocal.m;
    const close = ex.earlyClose2026[ymd(now, ex.ianaTz)] || ex.closeLocal;
    const cmin = close.h * 60 + close.m;
    return lmin >= omin && lmin < cmin;
  }

  function recentTransition(code, now, withinMs) {
    now = now || new Date();
    withinMs = withinMs || 2000;
    const ex = SCHEDULE[code];
    if (!ex) return null;
    const prev = new Date(now.getTime() - withinMs);
    const prevOpen = isOpenNow(code, prev);
    const currOpen = isOpenNow(code, now);
    if (!prevOpen && currOpen) {
      return { type: 'open',  code, name: ex.name, city: ex.city, bellVoice: ex.bellVoice, at: now };
    }
    if (prevOpen && !currOpen) {
      return { type: 'close', code, name: ex.name, city: ex.city, bellVoice: ex.bellVoice, at: now };
    }
    return null;
  }

  function ceremonyTimeLabel(code, now) {
    now = now || new Date();
    const ex = SCHEDULE[code];
    if (!ex) return '';
    const { h, m } = localHM(now, ex.ianaTz);
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  window.EXCHANGE_SCHEDULE = SCHEDULE;
  window.ExchangeSchedule = {
    isOpenNow,
    recentTransition,
    ceremonyTimeLabel,
    listCodes: () => Object.keys(SCHEDULE),
    info:      (code) => SCHEDULE[code] || null,
    isTradingDay: (code, date) => {
      const ex = SCHEDULE[code];
      return ex ? isTradingDay(ex, date || new Date()) : false;
    }
  };
})();
