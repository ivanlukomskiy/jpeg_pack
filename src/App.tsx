import { Link, Route, Routes } from 'react-router-dom';
import './App.css';
import { OneBlockTest } from './pages/one_block_test/one_block_test';
import { Benchmark } from './pages/benchmark/benchmark';
import { AppShell, Burger, Flex, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { EncodeFile } from './pages/encode-file/encode_file';

function App() {
  const [opened, { toggle }] = useDisclosure();
  const version = import.meta.env.VITE_APP_VERSION ?? 'dev'

  return (
    <AppShell
      padding="md"
      header={{ height: 60 }}
      navbar={{
        width: 100,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
    >
      <AppShell.Header style={{ border: 0, display: 'flex', alignItems: 'left' }}>
        <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="md" />
        <Flex direction={'row'} gap={'xl'} style={{ padding: '5px 20px', width: '100%' }} visibleFrom={'xs'} justify={'space-between'}>
          <Flex direction={'row'} gap={'xl'}>
            <Link to="/">file</Link>
            <Link to="/benchmark">benchmark</Link>
            <Link to="/block">single block</Link>
          </Flex>
          <Text style={{color: "lightgray"}}>{version}</Text>
        </Flex>
      </AppShell.Header>
      <AppShell.Navbar hiddenFrom="xs" style={{ display: 'flex', flexDirection: 'column', maxWidth: '100%' }}>
        <Link to="/" style={{ padding: 20 }} onClick={toggle}>
          file
        </Link>
        <Link to="/benchmark" style={{ padding: 20 }} onClick={toggle}>
          benchmark
        </Link>
        <Link to="/block" style={{ padding: 20 }} onClick={toggle}>
          single block
        </Link>
        <Text style={{color: "lightgray"}}>{version}</Text>
      </AppShell.Navbar>
      <AppShell.Main>
        <Routes>
          <Route path="/" element={<EncodeFile />} />
          <Route path="/benchmark" element={<Benchmark />} />
          <Route path="/block" element={<OneBlockTest />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}

export default App;
