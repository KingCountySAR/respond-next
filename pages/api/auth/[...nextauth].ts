import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID ?? '',
      clientSecret: process.env.GOOGLE_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const isAllowedToSignIn = true;
      console.log('Is user allowed?', user);

      return isAllowedToSignIn;
    }
  }
});