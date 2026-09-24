import assert from 'node:assert/strict';
process.env.NODE_ENV='production';
process.env.AGENT_REGISTRY_FALLBACK='true';
const {listAgents}=await import('../api/_agent-registry.js');
const agents=await listAgents('mazliprint');
assert.deepEqual(agents,[],'Production must not synthesize static agents when Supabase registry is unavailable.');
console.log('AGENT REGISTRY SOURCE-OF-TRUTH OK');
