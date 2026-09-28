import {IconDefinition} from '@fortawesome/fontawesome-svg-core';
import {faFacebook, faGithub, faGoogle, faTwitter} from '@fortawesome/free-brands-svg-icons';
import {AuthProvider, FacebookAuthProvider, GithubAuthProvider, GoogleAuthProvider, TwitterAuthProvider} from 'firebase/auth';

export interface SocialProvider {
  name: string;
  icon: IconDefinition;
  create: () => AuthProvider;
}

export const SOCIAL_PROVIDERS: readonly SocialProvider[] = [
  {name: 'Google', icon: faGoogle, create: () => new GoogleAuthProvider()},
  {name: 'Facebook', icon: faFacebook, create: () => new FacebookAuthProvider()},
  {name: 'GitHub', icon: faGithub, create: () => new GithubAuthProvider()},
  {name: 'Twitter', icon: faTwitter, create: () => new TwitterAuthProvider()}
];
