import { Route, Routes } from 'react-router'
import './App.css'
import { OneBlockTest } from './pages/one_block_test/one_block_test'
import { Benchmark } from './pages/benchmark/benchmark'
import { AppShell, Burger, Flex } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
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
        <Burger
          opened={opened}
          onClick={toggle}
          hiddenFrom="sm"
          size="sm"
        />
        <Flex direction={'row'} gap={'xl'} style={{padding: '5px 20px'}}>
          <a href="/imgen2/">file</a>
          <a href="/imgen2/benchmark">benchmark</a>
          <a href="/imgen2/block">single block</a>
        </Flex>
      </AppShell.Header>
      {/* <AppShell.Navbar>

      </AppShell.Navbar> */}
      <AppShell.Main>
        <Routes>
        <Route path="/imgen2/" element={<EncodeFile />} />
        <Route path="/imgen2/benchmark" element={<Benchmark />} />
        <Route path="/imgen2/block" element={<OneBlockTest />} />
      </Routes>
      </AppShell.Main>
    </AppShell>
  )
}

export default App
