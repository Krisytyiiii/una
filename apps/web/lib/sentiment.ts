/**
 * Shared feedback sentiment helpers — extracted verbatim from
 * app/(staff)/feedback/page.tsx. Pure, no UI change.
 */

export const STOPWORDS = new Set(
  "a,an,and,are,as,at,be,been,being,but,by,can,could,did,do,does,each,few,for,from,had,has,have,here,how,i,if,in,into,is,it,its,just,like,me,more,most,my,no,not,now,of,off,on,once,only,or,other,our,out,over,own,same,she,should,so,some,such,than,that,the,their,them,then,there,these,they,this,those,through,to,too,under,until,up,very,was,we,were,what,when,where,which,while,who,whom,will,with,you,your,session,sessions,counselor,counselors,really,very,much,lot,things,thing,feel,felt,also,after,before,again,always,never,ever,got,getting,going,went,come,came,today,yesterday,time,times,first,last,one,two,three,well,still,even,back,made,make,though,although,since,without,within,along,among,between,because,while,despite,toward,towards,upon,via,per".split(",")
);

export function sentimentOf(avg: number | null): { label: string; tone: "success" | "warning" | "danger" | "info"; hint: string } {
  if (avg === null) return { label: "No data yet", tone: "info", hint: "Ratings will appear once students respond." };
  if (avg >= 4.5) return { label: "Excellent", tone: "success", hint: "Students love the service — protect what's working." };
  if (avg >= 4.0) return { label: "Good", tone: "success", hint: "Solid overall. Mine the 3★ comments for quick wins." };
  if (avg >= 3.0) return { label: "Fair", tone: "warning", hint: "Mixed signals — review neutral and low comments below." };
  return { label: "Needs attention", tone: "danger", hint: "Satisfaction is low. Work the follow-up list first." };
}

/** Shape matches the shared `BarTooltip` used by ReportBars. */
export type RatingInsight = { title: string; value: string; hint: string };

/**
 * Hover copy for the 1–5★ distribution bars: the count, its share of all
 * responses, and what that band means for follow-up. Shared by the feedback
 * page and the head reports view so the wording never drifts.
 */
export function ratingBarInsight(
  point: { label: string; value: number },
  total: number
): RatingInsight {
  const stars = Number(point.label.replace("★", "")) || 0;
  const share = total ? Math.round((point.value / total) * 100) : 0;
  const responses = `${point.value} response${point.value === 1 ? "" : "s"} · ${share}% of responses`;
  if (stars >= 5) {
    return {
      title: "5-star · delighted",
      value: responses,
      hint: "Best possible score — these are the sessions to learn from.",
    };
  }
  if (stars === 4) {
    return {
      title: "4-star · satisfied",
      value: responses,
      hint: "Positive experience with room to improve — check what was missing.",
    };
  }
  if (stars === 3) {
    return {
      title: "3-star · mixed",
      value: responses,
      hint: "Neither positive nor negative — read the written comments.",
    };
  }
  if (stars === 2) {
    return {
      title: "2-star · dissatisfied",
      value: responses,
      hint: "Low rating — reach out and consider a service review.",
    };
  }
  return {
    title: "1-star · very dissatisfied",
    value: responses,
    hint: "Highest-priority follow-up — contact the student before it escalates.",
  };
}
