import "./App.css";

import Board from "./components/Board/Board";
import { initialBoard } from "./utils/mockData";

function App() {
  return <Board board={initialBoard} />;
}

export default App;
