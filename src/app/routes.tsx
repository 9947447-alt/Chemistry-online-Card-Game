import { LocalGamePage } from "../features/local-game/LocalGamePage";

export const routes = [
  {
    path: "/",
    element: <LocalGamePage />,
  },
] as const;
