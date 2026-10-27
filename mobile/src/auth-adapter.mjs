// Keep session/refresh-token persistence in the native plugin, never web storage.
export function createNativeAuthClient(plugin,ready=Promise.resolve()) {
  let generation=0;
  return {
    async getSession() {
      await ready;const serial=generation;
      const {session}=await plugin.getSession();
      if(serial!==generation)return {data:{user:null,token:null}};
      return {data:{user:session?.user||null}};
    },
    async token() {
      await ready;const serial=generation;
      const {session}=await plugin.getSession();
      if(serial!==generation)return {data:{user:null,token:null}};
      return {data:{token:session?.accessToken||null}};
    },
    signIn:{email:async options=>{await ready;await plugin.signInWithPassword({email:options.email,password:options.password});return {data:{}};}},
    signUp:{email:async options=>{await ready;await plugin.signUp({email:options.email,password:options.password,name:options.name});return {data:{}};}},
    signOut:async()=>{generation++;await ready;return plugin.signOut();}
  };
}
