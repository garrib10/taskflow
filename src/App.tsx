import "./App.css";

import Board from "./components/Board/Board";
import { useBoardReducer } from "./hooks/useBoardReducer";

function App() {
  const [board] = useBoardReducer();

  return <Board board={board} />;
}

export default App;
