import { Navigate, Route, Routes } from "react-router-dom";

import { GroupsPage } from "./pages/GroupsPage";
import { GroupPage } from "./pages/GroupPage";
import { LoginPage } from "./pages/LoginPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/groups" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/groups" element={<GroupsPage />} />
      <Route path="/groups/:groupId" element={<GroupPage />} />
      <Route path="*" element={<Navigate to="/groups" replace />} />
    </Routes>
  );
}

export default App;
