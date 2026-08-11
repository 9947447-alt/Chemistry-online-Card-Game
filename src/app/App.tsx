import {
  LocalGamePage,
  type LocalGamePageProps,
} from "../features/local-game/LocalGamePage";

export function App(props: LocalGamePageProps) {
  return <LocalGamePage {...props} />;
}
