import "./App.css";

import Board from "./components/Board/Board";
import { useBoardReducer } from "./hooks/useBoardReducer";

function App() {
  const [board, dispatch] = useBoardReducer();

  return <Board board={board} dispatch={dispatch} />;
}

export default App;
