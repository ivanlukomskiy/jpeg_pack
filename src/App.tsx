import { Route, Routes } from 'react-router'
import './App.css'
import { OneBlockTest } from './pages/one_block_test/one_block_test'
import { Benchmark } from './pages/benchmark/benchmark'
import { AppShell, Burger, Flex, NavLink } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { EncodeText } from './pages/encode-text/encode_text'


function App() {
  const [opened, { toggle }] = useDisclosure();
  
  return (
    <AppShell
      padding="md"
      header={{ height: 60, }}
      navbar={{
        width: 100,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
    >
      <AppShell.Header style={{border: 0}}>
        {/* <Burger
          opened={opened}
          onClick={toggle}
          hiddenFrom="sm"
          size="sm"
        /> */}
        <Flex direction={'row'} gap={'xl'} style={{padding: '5px 20px'}}>
          <a href="/">encode</a>
          <a href="/benchmark">benchmark</a>
          <a href="/block">single block</a>
        </Flex>
        {/* <div>Logo 123</div> */}
      </AppShell.Header>
      {/* <AppShell.Navbar>

      </AppShell.Navbar> */}
      <AppShell.Main>
        <Routes>
        <Route path="/" element={<EncodeText />} />
        <Route path="/benchmark" element={<Benchmark />} />
        <Route path="/block" element={<OneBlockTest />} />
      </Routes>
      </AppShell.Main>
    </AppShell>
  )
}

export default App
