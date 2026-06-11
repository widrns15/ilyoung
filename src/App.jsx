import { useApp } from './state/AppContext'
import AuthScreen from './screens/AuthScreen'
import PairScreen from './screens/PairScreen'
import Shell from './screens/Shell'

export default function App() {
  const { session, booting, paired, toastMsg } = useApp()

  let screen
  if (booting || session === undefined) {
    screen = <div className="spinner-page">불러오는 중…</div>
  } else if (!session) {
    screen = <AuthScreen />
  } else if (!paired) {
    screen = <PairScreen />
  } else {
    screen = <Shell />
  }

  return (
    <>
      {screen}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  )
}
