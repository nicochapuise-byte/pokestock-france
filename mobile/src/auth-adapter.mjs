// Keep session/refresh-token persistence in the native plugin, never web storage.
export function createNativeAuthClient(plugin,ready=Promise.resolve(),oauthRedirect) {
  let generation=0;
  return {
    async getSession() {
      await ready;const serial=generation;
      const {session}=await plugin.getSession();
      if(serial!==generation)return {data:{user:null,token:null}};
      return {data:{user:session?.user||null}};
    },
    async deletionSessionProof(){
      await ready;const serial=generation;
      const {session}=await plugin.getSession();
      if(serial!==generation||!session?.refreshToken)return null;
      // Native refreshToken is the signed session cookie; the DB stores its
      // secret token before the signature. Keep both exclusively in memory.
      try{return decodeURIComponent(session.refreshToken).split('.')[0]||null;}catch{return null;}
    },
    async token() {
      await ready;const serial=generation;
      const {session}=await plugin.getSession();
      if(serial!==generation)return {data:{user:null,token:null}};
      return {data:{token:session?.accessToken||null}};
    },
    signIn:{social:async options=>{await ready;if(options.provider!=='google'||!oauthRedirect)throw Error('Google sign-in unavailable');await plugin.signInWithOAuth({provider:'google',redirectTo:oauthRedirect});return {data:{pending:true}};},email:async options=>{await ready;await plugin.signInWithPassword({email:options.email,password:options.password});return {data:{}};}},
    signUp:{email:async options=>{await ready;await plugin.signUp({email:options.email,password:options.password,name:options.name});return {data:{}};}},
    signOut:async()=>{generation++;await ready;return plugin.signOut();}
  };
}
