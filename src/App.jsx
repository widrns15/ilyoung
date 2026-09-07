import { useState } from 'react'
import { useApp } from './state/AppContext'
import AuthScreen from './screens/AuthScreen'
import PairScreen from './screens/PairScreen'
import Shell from './screens/Shell'
import SplashScreen, { shouldShowSplash } from './components/SplashScreen'

export default function App() {
  const { session, booting, paired, toastMsg } = useApp()
  const [splash, setSplash] = useState(shouldShowSplash)

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
      {splash && (
        <SplashScreen
          ready={!booting && session !== undefined}
          onDone={() => setSplash(false)}
        />
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  )
}
