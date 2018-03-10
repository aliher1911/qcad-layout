include("scripts/EAction.js");

/**
 * \class KeyboardLayout
 * \ingroup ecma_misc
 **/
function KeyboardLayout(guiAction) {
    EAction.call(this, guiAction);
}

KeyboardLayout.prototype = new EAction();

// attaching action to menu/toolbars
KeyboardLayout.init = function(basePath) {
    var action = new RGuiAction(qsTr("Keyboard Layout"), RMainWindowQt.getMainWindow());
    action.setRequiresDocument(true);
    action.setScriptFile(basePath + "/KeyboardLayout.js");
    action.setIcon(basePath + "/KeyboardLayout.svg");
    action.setStatusTip(qsTr("Generate keyboard layers"));
    // what is it? item could be invoked by pressing this hotkey sequence
    action.setDefaultShortcut(new QKeySequence("k,l"));
    // what is it? it goes into command buffer as command
    action.setDefaultCommands(["keyboardlayout"]);
    // what is it?
    action.setGroupSortOrder(73100);
    // what is it?
    action.setSortOrder(400);
    // widget where this menu will be present (doesn't respect file hierarchy, could be multiple)
    action.setWidgetNames(["MiscMenu"]);
}

function extractComponents(blockName) {
    var parts = blockName.split('_');
    if (parts.length != 3 || parts[0] != "Key") {
        return null;
    }
    
    return {
        size: parts[1],
        plane: parts[2]
    };
}

// must query plane
function getSubplane(layerName) {
    var parts = layerName.split('_');
    if (parts.length!=2) {
        return [layerName, null];
    }
    return [parts[0], parts[1]];
}

// menu action
KeyboardLayout.prototype.beginEvent = function() {
    EAction.prototype.beginEvent.call(this);
    // outputs to stdout (normally invisible in gui app)
    qDebug("KeyboardLayout.prototype.beginEvent was called.");
    // outputs to app console
    EAction.handleUserMessage("Something is brewing");
    
    var doc = this.getDocument();

    // planeTypes{ plane name: { block type: id } }
    // blockTypes{ block id: block desc }
    // desc{ plane, size }
    
    // First find types of planes from block
    var planeTypes = {};
    var blockTypes = {};
    var blockIds = doc.queryAllBlocks();
    for (var i=0; i < blockIds.length; i++) {
        var block = doc.queryBlock(blockIds[i]);
        EAction.handleUserMessage("Block: " + block.getName());
        var desc = extractComponents(block.getName());
        if (desc) {
            EAction.handleUserMessage("Name matching to size " + desc.size + " plane " + desc.plane);
            if (!planeTypes.hasOwnProperty(desc.plane)) {
                planeTypes[desc.plane] = {};
            }
            planeTypes[desc.plane][desc.size] = blockIds[i];
            blockTypes[blockIds[i]] = desc;
        }
    }
    // Debug info about discovered blocks
    for (var plane in planeTypes) {
        EAction.handleUserMessage("Found plane: " + plane);
        for(var blockSize in planeTypes[plane]) {
            EAction.handleUserMessage("Size: " + blockSize + " id: " + planeTypes[plane][blockSize]);
        }
    }

    var di = this.getDocumentInterface();
    
    // all blocks that we want to build in other planes
    var templateEntities = [];
    // generated blocks from previous runs
    var oldEntities = [];
    // for each block of drawing, remove it if it is on layer in map and not layout
    var allBlockRefs = doc.queryAllBlockReferences();
    for (var i=0; i < allBlockRefs.length; i++) {
        var ref = allBlockRefs[i];
        EAction.handleUserMessage("Found blockref: " + ref);
        var entity = doc.queryEntity(ref);
        var blockId = entity.getReferencedBlockId();
        if (!blockTypes.hasOwnProperty(blockId)) {
            EAction.handleUserMessage("Skipping block on unknown type.");
            continue;
        }
        var desc = blockTypes[blockId];
        var templateSubplane = getSubplane(entity.getLayerName())[1];
        if (desc.plane == "Layout") {
            // register template with sublayer included
            templateEntities.push({entity: entity, subplane:templateSubplane});
        } else {
            // remove block
            oldEntities.push(entity);
        }
    }

    // Delete blocks that belong to generated planes
    if (oldEntities.length > 0) {
        var op = new RDeleteObjectsOperation();
        op.setText(this.getToolTitle() + " : Delete old planes");
        for(var i=0; i<oldEntities.length; i++) {
            var entity = oldEntities[i];
            op.deleteObject(entity);
        }
        di.applyOperation(op);
    }

    // generate new blocks in layers
    var op = new RAddObjectsOperation();
    op.setText(this.getToolTitle() + " : Generate planes");
    var layers = doc.queryAllLayers();
    for(var i=0; i<layers.length; i++) {
        var layerId = layers[i];
        var layer = doc.queryLayerDirect(layerId);
        var layerPlane = getSubplane(layer.getName());
        EAction.handleUserMessage("Checking for blocks for layer " + layer.getName() + "(" + layerId + ")");
        if (!planeTypes.hasOwnProperty(layerPlane[0])) {
            EAction.handleUserMessage("No generatable blocks");
            continue;
        }
        if (layerPlane[0] == "Layout") {
            EAction.handleUserMessage("Ignoring layout layer.");
            continue;
        }
        // layers have 2 components in name layer_sublayer
        // only instantiate if sublayer matches
        var layerBlocks = planeTypes[layerPlane[0]];
        for(var j=0; j<templateEntities.length; j++) {
            var subPlane = templateEntities[j].subplane;
            if (subPlane!=layerPlane[1]) {
                EAction.handleUserMessage("Template subplane " + subPlane + " != " + layerPlane[1]);
                continue;
            }
            var template = templateEntities[j].entity;
            var templateBlockId = template.getReferencedBlockId();
            var templateDesc = blockTypes[templateBlockId];
            if (!layerBlocks.hasOwnProperty(templateDesc.size)) {
                EAction.handleUserMessage("No block of size " + templateDesc.size + "in " + layerPlane[1]);
                continue;
            }
            var blockId = layerBlocks[templateDesc.size];
            EAction.handleUserMessage("Insert block " + blockId + " to " + subPlane);
            var templateBlockData = template.getData();
            var blockData = new RBlockReferenceData(
                blockId,
                templateBlockData.getPosition(),
                templateBlockData.getScaleFactors(),
                templateBlockData.getRotation(),
                templateBlockData.getColumnCount(),
                templateBlockData.getRowCount(),
                templateBlockData.getColumnSpacing(),
                templateBlockData.getRowSpacing()
            );
            var refEntity = new RBlockReferenceEntity(doc, blockData);
            refEntity.setLayerId(layerId);
            op.addObject(refEntity, false);
        }
    }
    di.applyOperation(op);
    
    // refresh document
    di.clearPreview();
    di.repaintViews();
    
    this.terminate();
};

// Stateless op
KeyboardLayout.State = {
    SettingPosition : 0
};
