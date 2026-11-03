import test from 'node:test';
import assert from 'node:assert/strict';

test('provider aliases retain the eight Admin/DB/runtime mappings', async () => {
  const {normalizeChannelProvider, runtimeChannelForProvider} = await import('../../../packages/shared/src/channel-provider-map.ts');
  for (const [admin, db, runtime] of [
    ['WEBCHAT','webchat','webchat'], ['KAKAO','kakao','kakao'], ['TEAMS','ms_teams','ms-teams'],
    ['SLACK','slack','slack'], ['DISCORD','discord','discord'], ['TELEGRAM','telegram','telegram'],
    ['GOOGLE_CHAT','google_chat','google-chat'], ['LINE','line','line'],
  ]) {
    for (const alias of [admin,db,runtime]) {
      assert.equal(normalizeChannelProvider(alias),db);
      assert.equal(runtimeChannelForProvider(normalizeChannelProvider(alias)),runtime);
    }
  }
  for (const invalid of ['teams','MS_TEAMS','googlechat','',null,{},' slack ']) {
    assert.throws(() => normalizeChannelProvider(invalid));
  }
});
