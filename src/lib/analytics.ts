import { MatchEvent } from "./offlineSync";

export interface LineupStat {
  lineupIds: string[];
  lineupNames: string[];
  pointsFor: number;
  pointsAgainst: number;
  netRating: number;
  possessions: number;
}

/**
 * Parses play-by-play events to determine the Plus/Minus (Net Rating) of 5-man lineups.
 * If substitution tracking (SUB_IN / SUB_OUT) is present, it dynamically updates the 5 men on the court.
 * Otherwise, it defaults to the starting lineup or infers the most active 5 players.
 */
export const calculateLineupStats = (
  events: MatchEvent[], 
  teamId: "home" | "away", 
  roster: { id: string; name: string; isStarter: boolean }[]
): LineupStat[] => {
  
  const lineupMap: Record<string, LineupStat> = {};
  
  // Initialize the current lineup with starters
  let currentLineup = roster.filter(p => p.isStarter).map(p => p.id).sort();
  
  const getLineupKey = (ids: string[]) => ids.join("|");
  
  const ensureLineupExists = (ids: string[]) => {
      const key = getLineupKey(ids);
      if (!lineupMap[key]) {
          lineupMap[key] = {
              lineupIds: [...ids],
              lineupNames: ids.map(id => roster.find(r => r.id === id)?.name || "Unknown"),
              pointsFor: 0,
              pointsAgainst: 0,
              netRating: 0,
              possessions: 0
          };
      }
      return key;
  };

  // Ensure default starter lineup exists
  if (currentLineup.length > 0) {
      ensureLineupExists(currentLineup);
  }

  // Linear scan through events
  events.sort((a, b) => a.timestamp - b.timestamp).forEach((e) => {
      
      // Handle Substitutions if they exist in the event log
      if (e.type === "SUB_OUT" && e.team === teamId) {
          currentLineup = currentLineup.filter(id => id !== e.playerId);
      } else if (e.type === "SUB_IN" && e.team === teamId) {
          if (!currentLineup.includes(e.playerId)) {
              currentLineup.push(e.playerId);
              currentLineup.sort();
          }
      }

      if (currentLineup.length === 0) return; // Edge case
      
      const key = ensureLineupExists(currentLineup);
      const stat = lineupMap[key];

      // Points calculation
      let points = 0;
      if (["1PT", "FTM"].includes(e.type)) points = 1;
      if (["2PT", "DNK"].includes(e.type)) points = 2;
      if (e.type === "3PT") points = 3;

      if (points > 0) {
          if (e.team === teamId) {
              stat.pointsFor += points;
              stat.possessions += 1;
          } else {
              stat.pointsAgainst += points;
          }
      }
      
      // Update possession estimate on Turnovers
      if (e.type === "TOV" && e.team === teamId) {
          stat.possessions += 1;
      }
  });

  // Calculate Net Rating
  Object.values(lineupMap).forEach(stat => {
     // Net Rating = (Points For - Points Against)
     // Normally it's per 100 possessions, but for simple app metrics, raw Plus/Minus is better understood.
     // We will store raw Plus/Minus in NetRating for now, and calculate Per100 if possessions > 0
     if (stat.possessions > 3) {
        // Offensive Rating - Defensive Rating (approximated)
        const offRtg = (stat.pointsFor / stat.possessions) * 100;
        const defRtg = (stat.pointsAgainst / stat.possessions) * 100; // Simplified
        stat.netRating = parseFloat((offRtg - defRtg).toFixed(1));
     } else {
        stat.netRating = stat.pointsFor - stat.pointsAgainst; // Raw +/-
     }
  });

  // Return sorted by best Net Rating
  return Object.values(lineupMap)
    .filter(l => l.lineupNames.length > 0)
    .sort((a, b) => b.netRating - a.netRating);
};
