import { Route, Routes } from 'react-router'
import './App.css'
import { OneBlockTest } from './pages/one_block_test/one_block_test'
import { Benchmark } from './pages/benchmark/benchmark'
import { AppShell, Burger, Flex, NavLink } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { EncodeText } from './pages/encode-text/encode_text'
import { EncodeFile } from './pages/encode-file/encode_file'


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
          <a href="/">file</a>
          <a href="/text">text</a>
          <a href="/benchmark">benchmark</a>
          <a href="/block">single block</a>
        </Flex>
        {/* <div>Logo 123</div> */}
      </AppShell.Header>
      {/* <AppShell.Navbar>

      </AppShell.Navbar> */}
      <AppShell.Main>
        <Routes>
        <Route path="/" element={<EncodeFile />} />
        <Route path="/text" element={<EncodeText />} />
        <Route path="/benchmark" element={<Benchmark />} />
        <Route path="/block" element={<OneBlockTest />} />
      </Routes>
      </AppShell.Main>
    </AppShell>
  )
}

export default App
