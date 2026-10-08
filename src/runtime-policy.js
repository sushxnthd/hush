// Security is the default, including source checkouts and portable launchers.
// An anonymous API is permitted only in an explicitly configured dev fixture.
export function runtimePolicy(env=process.env){
  const production=env.NODE_ENV!=='development'&&env.NODE_ENV!=='test';
  const localClientAuth=production||env.HUSH_REQUIRE_LOCAL_AUTH!=='0';
  const raw=String(env.PORT||8787);
  if(!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>65535) throw new Error('PORT must be an integer between 1 and 65535');
  return {production,localClientAuth,port:Number(raw)};
}
