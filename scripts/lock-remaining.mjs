/**
 * Lock remaining publicProcedure mutations that the first script missed.
 * These are multi-line patterns where publicProcedure is on a separate line from .mutation()
 */
import fs from 'fs';

const ROUTERS_PATH = '/home/ubuntu/geopolitical-news-intelligence/server/routers.ts';

let content = fs.readFileSync(ROUTERS_PATH, 'utf-8');
const lines = content.split('\n');

// Map of line numbers to replacement tier
// Admin: agencies create/update, facilities create/update/addSource/submitCandidate/updateCandidate/approveCandidate/searchOnline,
//        scheduler updateConfig, webhooks create/update, notifications create
// Analyst: generateReport, save (investigations)
const replacements = {
  120: 'adminProcedure',    // agencies.create
  152: 'adminProcedure',    // agencies.update
  397: 'adminProcedure',    // facilities.create
  440: 'adminProcedure',    // facilities.update
  495: 'adminProcedure',    // facilities.addSource
  532: 'adminProcedure',    // facilities.submitCandidate
  571: 'adminProcedure',    // facilities.updateCandidate
  618: 'adminProcedure',    // facilities.approveCandidate
  736: 'adminProcedure',    // facilities.searchOnline
  1809: 'adminProcedure',   // notifications.create
  1864: 'analystProcedure', // generateReport
  2490: 'analystProcedure', // investigations.save
  2798: 'adminProcedure',   // scheduler.updateConfig
  2837: 'adminProcedure',   // webhooks/missions.create (pipeline)
  2859: 'adminProcedure',   // webhooks/missions.update (pipeline)
  3043: 'adminProcedure',   // webhooks.create
  3070: 'adminProcedure',   // webhooks.update
};

let changes = 0;
for (const [lineNum, tier] of Object.entries(replacements)) {
  const idx = parseInt(lineNum) - 1;
  if (lines[idx] && lines[idx].includes('publicProcedure')) {
    lines[idx] = lines[idx].replace('publicProcedure', tier);
    changes++;
  } else {
    console.log(`WARNING: Line ${lineNum} does not contain publicProcedure: "${lines[idx]?.trim()}"`);
  }
}

fs.writeFileSync(ROUTERS_PATH, lines.join('\n'));
console.log(`Locked ${changes} remaining mutations.`);
