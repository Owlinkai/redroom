/**
 * This script replaces publicProcedure with adminProcedure or analystProcedure
 * on all mutation lines in routers.ts and routers/missions.ts.
 * 
 * Classification:
 * - ADMIN: crawl, delete, bulk, schedule, webhook, trigger, enrichment, rematch, cleanup, import
 * - ANALYST: create (user-facing), update (user-facing), save, mark, assign
 * - PUBLIC: auth.logout only
 */
import fs from 'fs';

const ROUTERS_PATH = '/home/ubuntu/geopolitical-news-intelligence/server/routers.ts';
const MISSIONS_PATH = '/home/ubuntu/geopolitical-news-intelligence/server/routers/missions.ts';

// Admin-only keywords in the procedure name context (line before .mutation)
const ADMIN_KEYWORDS = [
  'crawl', 'Crawl', 'bulk', 'Bulk', 'schedule', 'Schedule',
  'trigger', 'Trigger', 'webhook', 'Webhook', 'delete', 'Delete',
  'cleanup', 'Cleanup', 'import', 'Import', 'reenrich', 'Reenrich',
  'rematch', 'Rematch', 'clear', 'Clear', 'remove', 'Remove',
  'cancel', 'Cancel', 'run', 'Run', 'quick', 'Quick',
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let changes = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip if already uses adminProcedure or analystProcedure or protectedProcedure
    if (line.includes('adminProcedure') || line.includes('analystProcedure') || line.includes('protectedProcedure')) continue;
    
    // Only process lines that have publicProcedure with .mutation or lines that lead to .mutation
    if (line.includes('publicProcedure') && line.includes('.mutation(')) {
      // This is a direct publicProcedure.mutation() line
      // Check if it's the logout mutation
      if (line.includes('logout')) continue;
      
      // Check context (look at surrounding lines for procedure name)
      const context = lines.slice(Math.max(0, i - 5), i + 1).join(' ');
      const isAdmin = ADMIN_KEYWORDS.some(kw => context.includes(kw));
      
      const replacement = isAdmin ? 'adminProcedure' : 'analystProcedure';
      lines[i] = line.replace('publicProcedure', replacement);
      changes++;
    } else if (line.includes('publicProcedure') && !line.includes('.query(') && !line.includes('.query<')) {
      // This is a publicProcedure that starts a chain (with .input() before .mutation())
      // Look ahead to see if it leads to .mutation(
      const lookAhead = lines.slice(i, Math.min(lines.length, i + 8)).join(' ');
      if (lookAhead.includes('.mutation(')) {
        // Skip logout
        if (line.includes('logout')) continue;
        
        // Get the procedure name from the line or surrounding context
        const context = lines.slice(Math.max(0, i - 2), i + 8).join(' ');
        const isAdmin = ADMIN_KEYWORDS.some(kw => context.includes(kw));
        
        const replacement = isAdmin ? 'adminProcedure' : 'analystProcedure';
        lines[i] = line.replace('publicProcedure', replacement);
        changes++;
      }
    }
  }

  fs.writeFileSync(filePath, lines.join('\n'));
  console.log(`${filePath}: ${changes} mutations locked`);
}

processFile(ROUTERS_PATH);
processFile(MISSIONS_PATH);
console.log('Done! All mutations locked to appropriate tiers.');
