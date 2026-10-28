// A renewed JWT is not proof of a recent login. Require the actual live
// session secret and check its immutable creation date on this Auth branch.
export async function hasRecentErasureSession(sql,request,userId){
 const token=request.headers.get('x-pokestock-session');
 if(typeof token!=='string'||token.length<16||token.length>4096||/\s/.test(token))return false;
 const rows=await sql(`SELECT EXISTS (
  SELECT 1 FROM neon_auth.session
  WHERE token=$1 AND "userId"::text=$2
   AND "expiresAt">now()
   AND "createdAt">now()-interval '5 minutes'
   AND "createdAt"<=now()
 ) AS fresh`,[token,userId]);
 return rows[0]?.fresh===true;
}
