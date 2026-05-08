package org.noear.solon.codecli.memory;


import org.noear.solon.ai.harness.HarnessEngine;
import org.noear.solon.ai.harness.HarnessProperties;
import org.noear.solon.ai.skills.memory.MemorySearchProvider;
import org.noear.solon.ai.skills.memory.MemorySolution;
import org.noear.solon.ai.skills.memory.MemoryStoreProvider;
import org.noear.solon.ai.skills.memory.md.MemoryMdData;
import org.noear.solon.ai.skills.memory.search.MemorySearchProviderMdImpl;
import org.noear.solon.ai.skills.memory.store.MemoryStoreProviderMdImpl;

import java.nio.file.Paths;

/**
 *
 * @author noear 2026/3/23 created
 *
 */
public class MemorySolutionImpl implements MemorySolution {
    private MemorySearchProvider searchProvider;
    private MemoryStoreProvider storeProvider;

    public MemorySolutionImpl(String __cwd, HarnessProperties props) {
        MemoryMdData mdData = new MemoryMdData(Paths.get(__cwd, props.getHarnessMemory()));

        //String lucenePath = Paths.get(__cwd, props.getHarnessMemory(), "lucene").toAbsolutePath().toString();
        //String roguePath = Paths.get(__cwd, props.getHarnessMemory(), "rogue").toAbsolutePath().toString();

        searchProvider = new MemorySearchProviderMdImpl(mdData); //new MemorySearchProviderLuceneImpl(lucenePath);
        storeProvider = new MemoryStoreProviderMdImpl(mdData); //new MemoryStoreProviderRogueImpl(roguePath);
    }

    @Override
    public MemorySearchProvider getSearchProvider() {
        return searchProvider;
    }

    @Override
    public MemoryStoreProvider getStoreProvider() {
        return storeProvider;
    }
}