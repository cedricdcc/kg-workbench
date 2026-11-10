-- Seed: Decommissioning ontology demo data
-- Development dataset maintained directly in this file.

INSERT INTO ontology_documents (id, name, version, source_file, default_language, usecase, group_key, linkml_yaml, ohi_yaml, ohi_lockfile, ui_layout) VALUES
  ('5008c4d1-7937-535e-8bb5-c47d306b19ec', 'Nuclear Decommissioning Test Ontology', '0.2.0-test', 'decommissioning_ontology_import_large.json', 'en', 'A larger test ontology for importing modular decommissioning concepts, competency questions, examples, translations, notes, relation attributes, and extraction-aligned facts.', 'shared',
$$id: https://kg-workbench.local/ontology/5008c4d1-7937-535e-8bb5-c47d306b19ec#
name: Nuclear_Decommissioning_Test_Ontology
description: A larger test ontology for importing modular decommissioning concepts, competency questions, examples, translations, notes, relation attributes, and extraction-aligned facts.
in_language: en
version: 0.2.0-test
default_range: string
prefixes:
  linkml: https://w3id.org/linkml/
  ont: https://kg-workbench.local/ontology/5008c4d1-7937-535e-8bb5-c47d306b19ec#
imports:
  - linkml:types
subsets:
  facility_context:
    description: Models the nuclear facility, reactor units, buildings, systems, and components relevant for decommissioning.
    annotations:
      kg_name: Facility and Asset Context
  regulatory_compliance:
    description: Models authorities, permits, legal requirements, inspections, and regulatory reports.
    annotations:
      kg_name: Regulatory Compliance and Permits
  decommissioning_planning:
    description: Models projects, phases, decommissioning steps, work packages, milestones, contractors, and dependencies.
    annotations:
      kg_name: Decommissioning Planning and Execution
  radiological_safety:
    description: Models radiological inventories, contamination zones, dose constraints, safety measures, and monitoring programs.
    annotations:
      kg_name: Radiological Characterization and Safety
  waste_management:
    description: Models waste streams, waste packages, clearance measurements, transport campaigns, and disposal facilities.
    annotations:
      kg_name: Waste Management and Clearance
slots:
  projectTargetsFacility:
    domain: DecommissioningProject
    range: Facility
  facilityHasUnit:
    domain: Facility
    range: ReactorUnit
  componentLocatedInBuilding:
    domain: Component
    range: Building
  legalRequirementConstrainsPermit:
    domain: LegalRequirement
    range: Permit
  permitIssuedByAuthority:
    domain: Permit
    range: Authority
  permitAppliesToProject:
    domain: Permit
    range: DecommissioningProject
  permitApprovesStep:
    domain: Permit
    range: DecommissioningStep
  permitRequiresReport:
    domain: Permit
    range: RegulatoryReport
  reportDocumentsMonitoringProgram:
    domain: RegulatoryReport
    range: MonitoringProgram
  projectHasPhase:
    domain: DecommissioningProject
    range: DecommissioningPhase
  phaseIncludesStep:
    domain: DecommissioningPhase
    range: DecommissioningStep
  stepDependsOnStep:
    domain: DecommissioningStep
    range: DecommissioningStep
  stepHasWorkPackage:
    domain: DecommissioningStep
    range: WorkPackage
  inventoryCharacterizesComponent:
    domain: RadiologicalInventory
    range: Component
  componentLocatedInZone:
    domain: Component
    range: ContaminationZone
  stepRequiresSafetyMeasure:
    domain: DecommissioningStep
    range: SafetyMeasure
  stepSubjectToDoseConstraint:
    domain: DecommissioningStep
    range: DoseConstraint
  monitoringProgramObservesZone:
    domain: MonitoringProgram
    range: ContaminationZone
  stepGeneratesWasteStream:
    domain: DecommissioningStep
    range: WasteStream
  wasteStreamPackedInPackage:
    domain: WasteStream
    range: WastePackage
  packageRequiresClearanceMeasurement:
    domain: WastePackage
    range: ClearanceMeasurement
  clearanceMeasurementSupportsRelease:
    domain: ClearanceMeasurement
    range: WastePackage
  packageTransportedToDisposalFacility:
    domain: WastePackage
    range: DisposalFacility
  transportCampaignMovesPackage:
    domain: TransportCampaign
    range: WastePackage
classes:
  Facility:
    description: A licensed nuclear site or installation undergoing preparation, operation, post-operation, or decommissioning.
    in_subset:
      - facility_context
    slots:
      - facilityHasUnit
    attributes:
      facilityIdentifier:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
      officialName:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
      location:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
      operatorName:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  ReactorUnit:
    description: A reactor block or unit that is part of a facility and may be decommissioned as a distinct asset.
    in_subset:
      - facility_context
    attributes:
      unitCode:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
      reactorType:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  Building:
    description: A building or physical structure within the facility boundary.
    in_subset:
      - facility_context
    attributes:
      buildingCode:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
      buildingName:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  System:
    description: A technical system of the nuclear facility, such as cooling, ventilation, or residual heat removal.
    in_subset:
      - facility_context
  Component:
    description: A physical plant component that may be characterized, dismantled, packed, or cleared.
    in_subset:
      - facility_context
    slots:
      - componentLocatedInBuilding
      - componentLocatedInZone
    attributes:
      componentTag:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
      componentName:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  Authority:
    description: A competent regulatory, supervisory, or inspection authority.
    in_subset:
      - regulatory_compliance
    attributes:
      authorityName:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
      jurisdiction:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  Permit:
    description: A legal authorization, license, or approval relevant to decommissioning activities.
    in_subset:
      - regulatory_compliance
    slots:
      - permitIssuedByAuthority
      - permitAppliesToProject
      - permitApprovesStep
      - permitRequiresReport
    attributes:
      permitNumber:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
      permitTitle:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
      status:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  LegalRequirement:
    description: A statute, regulation, permit condition, guideline, or binding requirement.
    in_subset:
      - regulatory_compliance
    slots:
      - legalRequirementConstrainsPermit
    attributes:
      legalReference:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
      requirementText:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  RegulatoryReport:
    description: A report submitted to or requested by the authority.
    in_subset:
      - regulatory_compliance
    slots:
      - reportDocumentsMonitoringProgram
    attributes:
      reportId:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
      reportType:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  Inspection:
    description: An inspection, audit, or site visit performed by an authority or technical expert organization.
    in_subset:
      - regulatory_compliance
  DecommissioningProject:
    description: A managed project that plans and executes decommissioning of a nuclear facility or asset.
    in_subset:
      - decommissioning_planning
    slots:
      - projectTargetsFacility
      - projectHasPhase
    attributes:
      projectId:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
      projectName:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  DecommissioningPhase:
    description: A high-level phase of decommissioning, such as post-operation, dismantling, or site release.
    in_subset:
      - decommissioning_planning
    slots:
      - phaseIncludesStep
    attributes:
      phaseCode:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
      phaseName:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  DecommissioningStep:
    description: A concrete dismantling, decontamination, planning, measurement, or release step.
    in_subset:
      - decommissioning_planning
    slots:
      - stepDependsOnStep
      - stepHasWorkPackage
      - stepRequiresSafetyMeasure
      - stepSubjectToDoseConstraint
      - stepGeneratesWasteStream
    attributes:
      stepId:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
      stepName:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
      status:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  WorkPackage:
    description: A package of tasks assigned to a team or contractor.
    in_subset:
      - decommissioning_planning
    attributes:
      workPackageCode:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  Milestone:
    description: A significant planned or achieved event in the decommissioning schedule.
    in_subset:
      - decommissioning_planning
  Contractor:
    description: An external or internal organization assigned to perform work packages.
    in_subset:
      - decommissioning_planning
  RadiologicalInventory:
    description: A record of radionuclides, activity levels, dose rates, and material characterization assumptions.
    in_subset:
      - radiological_safety
    slots:
      - inventoryCharacterizesComponent
    attributes:
      inventoryId:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  ContaminationZone:
    description: A zone with a specific radiological classification or contamination pattern.
    in_subset:
      - radiological_safety
    attributes:
      zoneId:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  DoseConstraint:
    description: A dose limit, dose constraint, or planning value applied to work activities.
    in_subset:
      - radiological_safety
    attributes:
      constraintCode:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  SafetyMeasure:
    description: A technical, organizational, or procedural measure reducing hazards or exposure.
    in_subset:
      - radiological_safety
    attributes:
      measureId:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  MonitoringProgram:
    description: A measurement or surveillance program for dose rates, contamination, effluents, or environmental indicators.
    in_subset:
      - radiological_safety
    slots:
      - monitoringProgramObservesZone
    attributes:
      programId:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  WasteStream:
    description: A stream of generated material or waste with shared origin, category, and treatment path.
    in_subset:
      - waste_management
    slots:
      - wasteStreamPackedInPackage
    attributes:
      streamId:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  WastePackage:
    description: A drum, container, box, or other package for waste storage, transport, clearance, or disposal.
    in_subset:
      - waste_management
    slots:
      - packageRequiresClearanceMeasurement
      - packageTransportedToDisposalFacility
    attributes:
      packageId:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  ClearanceMeasurement:
    description: A measurement used to support clearance, release, or classification decisions.
    in_subset:
      - waste_management
    slots:
      - clearanceMeasurementSupportsRelease
    attributes:
      measurementId:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  TransportCampaign:
    description: A planned or executed campaign to move waste packages from one location to another.
    in_subset:
      - waste_management
    slots:
      - transportCampaignMovesPackage
    attributes:
      campaignId:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
  DisposalFacility:
    description: A storage, disposal, or external treatment facility receiving waste packages.
    in_subset:
      - waste_management
    attributes:
      disposalFacilityId:
        range: string
        required: true
        annotations:
          kg_data_type: xsd:string
$$,
$$name: Nuclear_Decommissioning_Test_Ontology
version: 0.2.0-test
dependencies: []
$$,
'{"lock_version":2,"selections":[],"files":[]}'::jsonb,
'{"classPositions":{},"moduleLayouts":{}}'::jsonb);


INSERT INTO ontology_competency_questions (id, ontology_id, question, subject_class_id, predicate_relation_id, object_class_id, subject_example_id, predicate_example_id, object_example_id, sort_order) VALUES
  ('93ab5459-e23e-5b58-be2a-ee308c17ccca', '5008c4d1-7937-535e-8bb5-c47d306b19ec', 'Which facility is targeted by the KBR Unit A decommissioning project?', 'DecommissioningProject', 'projectTargetsFacility', 'Facility', 'd7c3e900-24b6-5112-b996-aed4cea502b4', 'be9deaae-85a2-5900-9507-95f1c0354995', 'df8f885d-7c83-5d04-b210-6e6f63f06801', 1),
  ('ea7165cf-9144-5052-a230-21e8839d7a47', '5008c4d1-7937-535e-8bb5-c47d306b19ec', 'Which authority issued the decommissioning permit KBR-DEC-2026-01?', 'Permit', 'permitIssuedByAuthority', 'Authority', '89fa6f1f-2ff6-51db-9089-3fbf68bd2ac9', '212777a0-4c54-546a-b7ee-7900ca0c8e1a', '02584b28-a294-52b3-98cb-3afe2524da53', 2),
  ('a4147063-0fe2-5e6b-99d0-52d953959d6c', '5008c4d1-7937-535e-8bb5-c47d306b19ec', 'Which legal requirement constrains the decommissioning permit?', 'LegalRequirement', 'legalRequirementConstrainsPermit', 'Permit', 'e737b800-1190-5c27-b02f-972509f0b83f', NULL, '89fa6f1f-2ff6-51db-9089-3fbf68bd2ac9', 3),
  ('d3d98606-fe3b-542c-93a3-50a6e59e0d82', '5008c4d1-7937-535e-8bb5-c47d306b19ec', 'Which decommissioning steps are included in the reactor internals segmentation phase?', 'DecommissioningPhase', 'phaseIncludesStep', 'DecommissioningStep', '297b184e-40f2-5766-8152-411b45918fc8', NULL, '1cd56543-004f-5855-9f9b-5e2cb726f66d', 4),
  ('a4b95712-c180-5194-8443-c2a7fae2b1a4', '5008c4d1-7937-535e-8bb5-c47d306b19ec', 'Which planned step depends on completed fuel removal verification?', 'DecommissioningStep', 'stepDependsOnStep', 'DecommissioningStep', '1cd56543-004f-5855-9f9b-5e2cb726f66d', '9dca386a-be94-54c3-8816-e29b1c7e80d6', 'f610b3ca-ce1d-5466-b5d8-9e82fd889a91', 5),
  ('1c5f2167-b99e-5f3f-b75d-4044cbfe9c31', '5008c4d1-7937-535e-8bb5-c47d306b19ec', 'Which component is characterized by the RPV radiological inventory?', 'RadiologicalInventory', 'inventoryCharacterizesComponent', 'Component', '74425d0b-eafb-515e-a56a-fc6bd5ccd12f', '8cb57191-a9ba-5196-ac9c-15ef39139a36', '33a2d645-f691-51f7-a415-d2773f8c730b', 6),
  ('e1f348da-a978-5a9d-b7eb-76a228521270', '5008c4d1-7937-535e-8bb5-c47d306b19ec', 'Which safety measure is required for underwater segmentation of RPV internals?', 'DecommissioningStep', 'stepRequiresSafetyMeasure', 'SafetyMeasure', '1cd56543-004f-5855-9f9b-5e2cb726f66d', NULL, 'd7011fd8-2c14-5b95-b703-4874363797ae', 7),
  ('f875042b-b7ad-5eb2-a6df-db02252da32f', '5008c4d1-7937-535e-8bb5-c47d306b19ec', 'Which waste stream is generated by underwater segmentation of RPV internals?', 'DecommissioningStep', 'stepGeneratesWasteStream', 'WasteStream', '1cd56543-004f-5855-9f9b-5e2cb726f66d', 'baa8908f-ac9c-5423-8fc2-0fc0deba24d0', 'ada0baee-65ab-5fe9-9adc-b2b2e646dc94', 8),
  ('b0a79f92-9daf-5c85-9a8d-d81e014855ba', '5008c4d1-7937-535e-8bb5-c47d306b19ec', 'Which clearance measurement is required for waste package WP-AM-001?', 'WastePackage', 'packageRequiresClearanceMeasurement', 'ClearanceMeasurement', '22c7fff7-2682-57b4-9dea-a1bcd11ab070', 'da0ce9f6-344d-5c21-aa35-d5814a3da385', '2b5d64fa-1276-5d07-b081-5c458785ea16', 9),
  ('c378d554-3af8-54e9-89c4-4b38102f451b', '5008c4d1-7937-535e-8bb5-c47d306b19ec', 'Which monitoring program observes the reactor cavity contamination zone RC-1?', 'MonitoringProgram', 'monitoringProgramObservesZone', 'ContaminationZone', 'f45ac1b9-ec42-576e-9e7c-6a9507bdc363', NULL, 'a0d187e0-4ed9-528c-9692-c26894f3cef7', 10),
  ('c6940acf-af68-5567-8c53-db2682f11ff8', '5008c4d1-7937-535e-8bb5-c47d306b19ec', 'Which regulatory report documents the monitoring program MP-RC1?', 'RegulatoryReport', 'reportDocumentsMonitoringProgram', 'MonitoringProgram', NULL, NULL, 'f45ac1b9-ec42-576e-9e7c-6a9507bdc363', 11),
  ('3952ad91-119f-5532-8e2b-e46b50498d78', '5008c4d1-7937-535e-8bb5-c47d306b19ec', 'Which disposal facility receives waste package WP-AM-001?', 'WastePackage', 'packageTransportedToDisposalFacility', 'DisposalFacility', '22c7fff7-2682-57b4-9dea-a1bcd11ab070', NULL, '7f658e17-d2b8-5821-97d2-9596da3360c9', 12);

INSERT INTO ontology_competency_question_modules (cq_id, module_id) VALUES
  ('93ab5459-e23e-5b58-be2a-ee308c17ccca', 'decommissioning_planning'),
  ('93ab5459-e23e-5b58-be2a-ee308c17ccca', 'facility_context'),
  ('ea7165cf-9144-5052-a230-21e8839d7a47', 'regulatory_compliance'),
  ('a4147063-0fe2-5e6b-99d0-52d953959d6c', 'regulatory_compliance'),
  ('d3d98606-fe3b-542c-93a3-50a6e59e0d82', 'decommissioning_planning'),
  ('a4b95712-c180-5194-8443-c2a7fae2b1a4', 'decommissioning_planning'),
  ('1c5f2167-b99e-5f3f-b75d-4044cbfe9c31', 'radiological_safety'),
  ('1c5f2167-b99e-5f3f-b75d-4044cbfe9c31', 'facility_context'),
  ('e1f348da-a978-5a9d-b7eb-76a228521270', 'decommissioning_planning'),
  ('e1f348da-a978-5a9d-b7eb-76a228521270', 'radiological_safety'),
  ('f875042b-b7ad-5eb2-a6df-db02252da32f', 'decommissioning_planning'),
  ('f875042b-b7ad-5eb2-a6df-db02252da32f', 'waste_management'),
  ('b0a79f92-9daf-5c85-9a8d-d81e014855ba', 'waste_management'),
  ('c378d554-3af8-54e9-89c4-4b38102f451b', 'radiological_safety'),
  ('c6940acf-af68-5567-8c53-db2682f11ff8', 'regulatory_compliance'),
  ('c6940acf-af68-5567-8c53-db2682f11ff8', 'radiological_safety'),
  ('3952ad91-119f-5532-8e2b-e46b50498d78', 'waste_management');


INSERT INTO documents (id, title, status, language, page_count, excerpt, tags, group_key) VALUES
  ('95838bcc-6871-5b9c-af53-baeb9a8a535d', 'KBR Unit A Decommissioning Extract', 'in_review', 'en', 12, 'The Kernkraftwerk Beispielrhein (KBR) is operated by BeispielEnergie GmbH and is located in North Rhine-Westphalia, Germany. The KBR Unit A Decommissioning Project targets the Kernkraftwerk Beispielrhein facility and focuses on Reactor Unit A.', ARRAY['decommissioning', 'mock', 'seed'], 'shared');

INSERT INTO document_sections (id, document_id, title, summary, sort_order) VALUES
  ('581d24ac-85b9-5894-9b96-f8fba5773f4c', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '1. Facility Overview', '', 0),
  ('4c680350-ea00-5760-b57f-824592428988', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '2. Asset Boundary and Components', '', 1),
  ('8e721495-32b9-572d-932a-cc8ccd0f223f', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '3. Legal Basis', '', 2),
  ('bacea2c3-39a8-5f44-b5d0-75d8e268be31', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '4. Decommissioning Permit', '', 3),
  ('eaa9f498-420f-59b9-80e8-9ed3f26cdbdf', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '5. Regulatory Authority and Reporting', '', 4),
  ('1a507940-b644-5fa3-9276-b5c1aad8a850', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '6. Project Phases and Milestones', '', 5),
  ('de15888f-3953-5bec-a872-48e8a9425b99', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '7. Step Dependencies and Work Packages', '', 6),
  ('394404ad-906f-57fe-8a5c-d21611889793', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '8. Radiological Characterization', '', 7),
  ('acf3a197-4528-5c2f-a6cb-a2384c14772e', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '9. Safety Measures and Dose Constraints', '', 8),
  ('79b49381-09bd-5a19-861f-039145729c9f', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '10. Monitoring Program', '', 9),
  ('2c6b5f85-51e7-5455-9a20-0e64dc5c0da9', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '11. Waste Generation and Packaging', '', 10),
  ('1f763abd-819e-5fd0-a5d3-a0e54f0fd9da', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '12. Clearance, Transport, and Disposal', '', 11);

INSERT INTO document_paragraphs (id, section_id, content, sort_order) VALUES
  ('6d35244a-0f81-5cd5-b98d-4dcacdfc2d51', '581d24ac-85b9-5894-9b96-f8fba5773f4c', 'The Kernkraftwerk Beispielrhein (KBR) is operated by BeispielEnergie GmbH and is located in North Rhine-Westphalia, Germany. The KBR Unit A Decommissioning Project targets the Kernkraftwerk Beispielrhein facility and focuses on Reactor Unit A.', 0),
  ('6a97e4e5-0176-5cde-88ac-933fcdae5655', '581d24ac-85b9-5894-9b96-f8fba5773f4c', 'Reactor Unit A is a pressurized water reactor with a nominal thermal power of 3,800 MW. The operator states that Unit A has been fuel-free since 2025-12-15.', 1),
  ('c4249473-bd3a-5220-93f7-a210a7c67595', '4c680350-ea00-5760-b57f-824592428988', 'The reactor building RB-A contains the reactor cavity, the primary circuit work areas, and the RPV internals. The RPV internals are activated stainless steel components with an estimated mass of 42 tonnes.', 0),
  ('e461c0ee-0b64-54ce-a143-454a63a06a54', '4c680350-ea00-5760-b57f-824592428988', 'The residual heat removal system RHR-A and its associated valves are retained for post-operation support until the segmentation phase begins.', 1),
  ('557ad0dc-44a9-5686-bf46-f88ca26e878d', '8e721495-32b9-572d-932a-cc8ccd0f223f', 'AtG §7(3) is cited as the legal basis for authorization of decommissioning and dismantling of the licensed installation. The requirement is treated as binding for the decommissioning permit.', 0),
  ('9e00daed-12d0-58f2-b150-a302c7772916', '8e721495-32b9-572d-932a-cc8ccd0f223f', 'The project also references radiation protection planning values, but the permit identifies AtG §7(3) as the primary legal basis.', 1),
  ('ff372812-3b55-5052-b915-6a9f83e63515', 'bacea2c3-39a8-5f44-b5d0-75d8e268be31', 'Permit KBR-DEC-2026-01, titled ''Decommissioning and Dismantling Permit for KBR Unit A'', was issued on 2026-03-18 with status issued.', 0),
  ('46bf5a01-56a3-5a7b-acd5-855c5504195f', 'bacea2c3-39a8-5f44-b5d0-75d8e268be31', 'The permit applies to the KBR Unit A Decommissioning Project and explicitly approves the underwater segmentation of RPV internals after authority review of the detailed work package.', 1),
  ('3070ab21-c7a2-5b15-b566-d9021cf56e41', 'eaa9f498-420f-59b9-80e8-9ed3f26cdbdf', 'The Nuclear Supervisory Authority NRW issued Permit KBR-DEC-2026-01 for the KBR Unit A Decommissioning Project.', 0),
  ('f5be63fc-abe4-57b1-a2e5-f5d16e0051ba', 'eaa9f498-420f-59b9-80e8-9ed3f26cdbdf', 'The permit requires quarterly monitoring reports. Report REP-MP-RC1-Q3-2026 documents monitoring program MP-RC1 for the reactor cavity contamination zone.', 1),
  ('c0b7fa3d-c403-5699-b130-17d21016540b', '1a507940-b644-5fa3-9276-b5c1aad8a850', 'The KBR Unit A Decommissioning Project starts on 2026-05-01 and is managed by the BeispielEnergie Decommissioning Division.', 0),
  ('c5e81aa4-cd34-547e-824c-c8df4b9ba2cd', '1a507940-b644-5fa3-9276-b5c1aad8a850', 'Phase P2 Reactor Internals Segmentation includes Step ST-240 Underwater segmentation of RPV internals and follows the preparatory fuel removal verification phase.', 1),
  ('2b668343-0471-5319-bd54-c7b845793198', 'de15888f-3953-5bec-a872-48e8a9425b99', 'Step ST-010 Fuel removal verification is completed. Step ST-240 Underwater segmentation of RPV internals is planned and depends on Step ST-010 as a blocking technical and safety dependency.', 0),
  ('81e247cd-cae0-5836-b162-65ed7304d8fe', 'de15888f-3953-5bec-a872-48e8a9425b99', 'Work package WP-240-CUT defines shielded underwater cutting, filtration deployment, segment handling, and transfer to shielded boxes. The work package is safety relevant.', 1),
  ('31a63d1d-ce74-5513-8feb-9891194eee6b', '394404ad-906f-57fe-8a5c-d21611889793', 'Radiological inventory INV-RPV-A-2026 characterizes the RPV internals. The dominant nuclide is Co-60 and the estimated total activity is 780 GBq with an uncertainty of 18 percent.', 0),
  ('bb177c22-049c-5057-9aea-b05005f8d339', '394404ad-906f-57fe-8a5c-d21611889793', 'The RPV internals are located in contamination zone RC-1, the reactor cavity wet work area, which is classified as a high contamination zone.', 1),
  ('09e1d8d1-2fa7-5c52-bfd0-a8135216ce54', 'acf3a197-4528-5c2f-a6cb-a2384c14772e', 'Step ST-240 requires safety measure SM-UNDERWATER-CUTTING before work starts. The measure consists of underwater cutting with local filtration and shielded tooling.', 0),
  ('74bfd2d9-4c8b-5b88-93c7-f1360adf3e28', 'acf3a197-4528-5c2f-a6cb-a2384c14772e', 'The same step is subject to dose constraint DC-WORKER-20, which applies a worker dose limit of 20 mSv per year for the affected work group.', 1),
  ('4ea73be6-8322-556d-ab77-0375295527d7', '79b49381-09bd-5a19-861f-039145729c9f', 'Monitoring program MP-RC1 observes contamination zone RC-1. The program performs continuous dose rate monitoring and daily contamination checks.', 0),
  ('341c6e0e-84ed-550c-87da-bd75d9d39ce4', '79b49381-09bd-5a19-861f-039145729c9f', 'The Radiation Protection Team is responsible for MP-RC1, which starts before segmentation and continues through packaging operations.', 1),
  ('00afd5bc-8ab8-5527-ab6c-fb4c2cef9840', '2c6b5f85-51e7-5455-9a20-0e64dc5c0da9', 'Step ST-240 Underwater segmentation of RPV internals generates waste stream WS-AM-240, an activated metal stream with an estimated mass of 42 tonnes. The stream requires conditioning.', 0),
  ('7582467d-13f5-589b-97d9-e4aa7310748c', '2c6b5f85-51e7-5455-9a20-0e64dc5c0da9', 'Waste stream WS-AM-240 is packed in waste package WP-AM-001, a shielded box with a gross mass of 8.5 tonnes. The packaging status is planned for the first campaign.', 1),
  ('d6e13d23-8a90-55ed-b6ae-bb005617486c', '1f763abd-819e-5fd0-a5d3-a0e54f0fd9da', 'Waste package WP-AM-001 requires clearance measurement CM-AM-001. The measurement uses gamma spectrometry and did not pass the unrestricted release criterion on 2026-08-14.', 0),
  ('fbf145c3-0160-534c-b9ee-a6af0beed984', '1f763abd-819e-5fd0-a5d3-a0e54f0fd9da', 'Because unrestricted release was not achieved, WP-AM-001 is assigned to the Central interim storage facility ZL-Beta in Germany. Transport campaign TC-AM-2026-01 moves WP-AM-001 by road after route approval.', 1);

INSERT INTO extraction_runs (id, document_id, ontology_id, status, started_at, completed_at, group_key) VALUES
  ('fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '5008c4d1-7937-535e-8bb5-c47d306b19ec', 'completed', '2026-10-15T08:00:00Z', '2026-10-15T08:02:00Z', 'shared');

INSERT INTO document_entities (id, document_id, extraction_run_id, entity_text, class_id, review_status) VALUES
  ('ea5135b8-f0d9-5538-be96-f4c97b133251', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Kernkraftwerk Beispielrhein (KBR)', 'Facility', 'pending'),
  ('605c6207-ee25-5e33-b7d3-aada4fd9c81b', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Reactor Unit A', 'ReactorUnit', 'pending'),
  ('1027fffa-39cc-5d6c-89a7-636f26134e32', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'RPV internals of Unit A', 'Component', 'pending'),
  ('d88a8aae-8d09-5388-8d99-124511424f09', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'reactor building RB-A', 'Building', 'pending'),
  ('89697a05-e78d-5f9c-b7d9-0beac16be3b0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'KBR Unit A Decommissioning Project', 'DecommissioningProject', 'pending'),
  ('ebbd4c9d-03a4-5a36-b1a7-fd7a70cc1ded', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Nuclear Supervisory Authority NRW', 'Authority', 'pending'),
  ('1481f9c3-b650-52ed-815c-27373a818d20', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Permit KBR-DEC-2026-01', 'Permit', 'pending'),
  ('91100fea-db32-57fc-9ede-5f416f1b322f', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'AtG §7(3)', 'LegalRequirement', 'pending'),
  ('33b7fbe1-85b6-55a7-9944-c11b4f8204a8', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Report REP-MP-RC1-Q3-2026', 'RegulatoryReport', 'pending'),
  ('7dcfe1ee-a338-5775-9ae5-e336261bdec1', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Phase P2 Reactor Internals Segmentation', 'DecommissioningPhase', 'pending'),
  ('92bff7ee-4832-5cd6-add8-9995269f3630', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Step ST-010 Fuel removal verification', 'DecommissioningStep', 'pending'),
  ('dd60a0cd-0942-5b13-9c09-9a392abcaec5', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Step ST-240 Underwater segmentation of RPV internals', 'DecommissioningStep', 'pending'),
  ('4541cf68-6a81-52b5-8ab8-76820d6be6cb', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Work package WP-240-CUT', 'WorkPackage', 'pending'),
  ('f7295603-6af8-549f-b101-5d8e1625f062', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Inventory INV-RPV-A-2026', 'RadiologicalInventory', 'pending'),
  ('eeebfa24-2d04-507a-a4c6-b854d92d454e', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Zone RC-1 Reactor cavity wet work area', 'ContaminationZone', 'pending'),
  ('544ddd92-c905-5567-a53d-e9fd845e0797', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Safety measure SM-UNDERWATER-CUTTING', 'SafetyMeasure', 'pending'),
  ('94db59ab-2f06-5623-a34c-2649dfb3068c', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'dose constraint DC-WORKER-20', 'DoseConstraint', 'pending'),
  ('cfb1d293-8055-5e66-ac89-14f874a4ddf2', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Monitoring program MP-RC1', 'MonitoringProgram', 'pending'),
  ('630ecc97-8ab2-5f89-ace1-438370ce0586', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Waste stream WS-AM-240 activated metal from RPV internals segmentation', 'WasteStream', 'pending'),
  ('1a97e4ab-8a2a-50e7-ad8b-c886b8d925a5', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Waste package WP-AM-001', 'WastePackage', 'pending'),
  ('b82a9caf-6b08-587b-9271-badb053ac106', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Clearance measurement CM-AM-001', 'ClearanceMeasurement', 'pending'),
  ('9cbc6ab6-c3f1-51c0-b66f-9a896173b72b', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Central interim storage facility ZL-Beta in Germany', 'DisposalFacility', 'pending'),
  ('0c918b47-cfdf-5210-9fc7-52780af2b2ea', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', 'Transport campaign TC-AM-2026-01', 'TransportCampaign', 'pending');

INSERT INTO entity_attribute_values (id, entity_id, attribute_id, value) VALUES
  ('257b4aa0-2549-5167-9b0e-e4f5be7fd9b5', 'ea5135b8-f0d9-5538-be96-f4c97b133251', 'Facility.facilityIdentifier', 'KBR'),
  ('a5218ad7-45b4-50cb-a1e4-27901965e074', 'ea5135b8-f0d9-5538-be96-f4c97b133251', 'Facility.officialName', 'Kernkraftwerk Beispielrhein'),
  ('ace06b02-34ec-554f-9367-c60252e2e800', 'ea5135b8-f0d9-5538-be96-f4c97b133251', 'Facility.location', 'North Rhine-Westphalia, Germany'),
  ('ca1099ad-b409-5a0d-86a4-49033d3e9c0c', 'ea5135b8-f0d9-5538-be96-f4c97b133251', 'Facility.operatorName', 'BeispielEnergie GmbH'),
  ('bb27a36a-b87d-5b3b-be74-1f9923de90d0', '605c6207-ee25-5e33-b7d3-aada4fd9c81b', 'ReactorUnit.unitCode', 'A'),
  ('af89d437-af20-53bd-a9ef-89f4fdb1a41a', '605c6207-ee25-5e33-b7d3-aada4fd9c81b', 'ReactorUnit.reactorType', 'PWR'),
  ('08474033-5a3d-5325-ba84-4360e3771ebc', '605c6207-ee25-5e33-b7d3-aada4fd9c81b', 'ReactorUnit.thermalPowerMW', '3800'),
  ('6ed97ae9-d73e-5c3c-90a4-bf1cc7159c1c', '605c6207-ee25-5e33-b7d3-aada4fd9c81b', 'ReactorUnit.isFuelFree', 'true'),
  ('851fdda4-1ce5-5348-a663-68f95634c49e', '1027fffa-39cc-5d6c-89a7-636f26134e32', 'Component.componentTag', 'RPV-INT-A'),
  ('cf1f810e-40e5-54ae-97a1-a48a4d797cb2', '1027fffa-39cc-5d6c-89a7-636f26134e32', 'Component.componentName', 'RPV internals'),
  ('90c568a9-29e8-5010-92e0-7da1eaa26aa9', '1027fffa-39cc-5d6c-89a7-636f26134e32', 'Component.material', 'activated stainless steel'),
  ('a074a6e8-c74b-5da5-b8c0-da9c1f73771e', '1027fffa-39cc-5d6c-89a7-636f26134e32', 'Component.estimatedMassTonnes', '42'),
  ('9be7a947-bc24-59a1-9e50-12d2bf534411', '1027fffa-39cc-5d6c-89a7-636f26134e32', 'Component.isActivated', 'true'),
  ('96da87fa-e3e1-51a0-8937-7cc54c559422', 'd88a8aae-8d09-5388-8d99-124511424f09', 'Building.buildingCode', 'RB-A'),
  ('00259cfe-12eb-5695-9a73-82243ca738b2', 'd88a8aae-8d09-5388-8d99-124511424f09', 'Building.buildingName', 'Reactor Building A'),
  ('5fb7f7e5-8a9a-5f19-b796-3182bac55d8b', 'd88a8aae-8d09-5388-8d99-124511424f09', 'Building.isRadiologicalArea', 'true'),
  ('f3388180-eec6-54d4-92c9-b7123e185432', '89697a05-e78d-5f9c-b7d9-0beac16be3b0', 'DecommissioningProject.projectId', 'KBR-A-DEC'),
  ('18bc79f9-df37-594a-b244-f311011c64d0', '89697a05-e78d-5f9c-b7d9-0beac16be3b0', 'DecommissioningProject.projectName', 'KBR Unit A Decommissioning Project'),
  ('ff53887c-bf7b-5b35-88ab-cabb7a7ad4b8', '89697a05-e78d-5f9c-b7d9-0beac16be3b0', 'DecommissioningProject.plannedStartDate', '2026-05-01'),
  ('45f40416-26bf-5480-a57a-ed06dd18fbf0', '89697a05-e78d-5f9c-b7d9-0beac16be3b0', 'DecommissioningProject.responsibleOrganization', 'BeispielEnergie Decommissioning Division'),
  ('069b75d2-39a0-57e9-8fd4-d1b55fa0fe22', 'ebbd4c9d-03a4-5a36-b1a7-fd7a70cc1ded', 'Authority.authorityName', 'Nuclear Supervisory Authority NRW'),
  ('88f875a6-daac-50fe-9eee-46ad1e8c2679', 'ebbd4c9d-03a4-5a36-b1a7-fd7a70cc1ded', 'Authority.jurisdiction', 'North Rhine-Westphalia'),
  ('098bd380-f688-51f4-b259-611e0637e09f', '1481f9c3-b650-52ed-815c-27373a818d20', 'Permit.permitNumber', 'KBR-DEC-2026-01'),
  ('d4bcbdc5-9f6f-590a-a5a0-c65cada5c462', '1481f9c3-b650-52ed-815c-27373a818d20', 'Permit.permitTitle', 'Decommissioning and Dismantling Permit for KBR Unit A'),
  ('a9f1aba9-4764-5740-8d87-33bc4adfaae3', '1481f9c3-b650-52ed-815c-27373a818d20', 'Permit.issueDate', '2026-03-18'),
  ('e704b47b-12f3-5c09-ae8a-413075c68b4e', '1481f9c3-b650-52ed-815c-27373a818d20', 'Permit.status', 'issued'),
  ('c8916063-527b-5c4c-b958-4592aa06f1bf', '1481f9c3-b650-52ed-815c-27373a818d20', 'Permit.legalBasis', 'AtG §7(3)'),
  ('98121965-2b77-5c75-8ef2-3ad2849d643f', '91100fea-db32-57fc-9ede-5f416f1b322f', 'LegalRequirement.legalReference', 'AtG §7(3)'),
  ('c827929d-c317-5361-b08c-3e1126dee45a', '91100fea-db32-57fc-9ede-5f416f1b322f', 'LegalRequirement.requirementText', 'authorization of decommissioning and dismantling of the licensed installation'),
  ('3309b2f7-e251-5175-a5fd-7f9b8fd23ac4', '91100fea-db32-57fc-9ede-5f416f1b322f', 'LegalRequirement.isBinding', 'true'),
  ('a08671c3-c3c3-5306-9744-b3285675f471', '33b7fbe1-85b6-55a7-9944-c11b4f8204a8', 'RegulatoryReport.reportId', 'REP-MP-RC1-Q3-2026'),
  ('a560ee8f-8d9e-5ccf-a9b9-325a8b4394ef', '33b7fbe1-85b6-55a7-9944-c11b4f8204a8', 'RegulatoryReport.reportType', 'quarterly monitoring report'),
  ('21e08131-091b-54d5-a291-d3ed706acdfc', '33b7fbe1-85b6-55a7-9944-c11b4f8204a8', 'RegulatoryReport.submissionDate', '2026-10-15'),
  ('9f850ed6-e9e6-5031-9c01-ac2a86dafe70', '33b7fbe1-85b6-55a7-9944-c11b4f8204a8', 'RegulatoryReport.isConfidential', 'false'),
  ('62448afd-f30c-5563-9cd5-dc84cbcc6c3b', '7dcfe1ee-a338-5775-9ae5-e336261bdec1', 'DecommissioningPhase.phaseCode', 'P2'),
  ('8d1c2256-4155-5b2b-be31-eac7f0c93232', '7dcfe1ee-a338-5775-9ae5-e336261bdec1', 'DecommissioningPhase.phaseName', 'Reactor Internals Segmentation'),
  ('c09d6e56-33a7-508d-97b0-ce97c7e238cb', '7dcfe1ee-a338-5775-9ae5-e336261bdec1', 'DecommissioningPhase.sequenceNumber', '2'),
  ('e594a3e6-35ba-5678-bacd-363beab0b2a9', '7dcfe1ee-a338-5775-9ae5-e336261bdec1', 'DecommissioningPhase.isActive', 'false'),
  ('86a7da33-0d11-56e5-a9c3-99dbac0079e7', '92bff7ee-4832-5cd6-add8-9995269f3630', 'DecommissioningStep.stepId', 'ST-010'),
  ('2d66b3b4-d99f-5bf3-b4e6-33493368fba6', '92bff7ee-4832-5cd6-add8-9995269f3630', 'DecommissioningStep.stepName', 'Fuel removal verification'),
  ('f17697df-d0bb-53dc-8790-d222626701ef', '92bff7ee-4832-5cd6-add8-9995269f3630', 'DecommissioningStep.status', 'completed'),
  ('d2243db4-9bef-5b77-abe6-35eb40792e28', '92bff7ee-4832-5cd6-add8-9995269f3630', 'DecommissioningStep.riskLevel', 'medium'),
  ('2ca6b2f6-005d-50ba-9360-162e6b7591b5', 'dd60a0cd-0942-5b13-9c09-9a392abcaec5', 'DecommissioningStep.stepId', 'ST-240'),
  ('ca933bf2-3ab7-5596-b09b-ba2f49a9eb4b', 'dd60a0cd-0942-5b13-9c09-9a392abcaec5', 'DecommissioningStep.stepName', 'Underwater segmentation of RPV internals'),
  ('63416a26-c408-5017-9459-6a23fb5d6c6d', 'dd60a0cd-0942-5b13-9c09-9a392abcaec5', 'DecommissioningStep.status', 'planned'),
  ('d4ee3e72-241e-59dd-8c56-854931ffbe53', 'dd60a0cd-0942-5b13-9c09-9a392abcaec5', 'DecommissioningStep.riskLevel', 'high'),
  ('d6dfdd69-cb58-5e8e-ada6-b2fc29eb5f79', '4541cf68-6a81-52b5-8ab8-76820d6be6cb', 'WorkPackage.workPackageCode', 'WP-240-CUT'),
  ('41b076b0-72a0-5141-a7ed-f05681c54ff4', '4541cf68-6a81-52b5-8ab8-76820d6be6cb', 'WorkPackage.workDescription', 'shielded underwater cutting, filtration deployment, segment handling, and transfer to shielded boxes'),
  ('6a8b7ad8-b849-56f0-977a-54fcd1af43fc', '4541cf68-6a81-52b5-8ab8-76820d6be6cb', 'WorkPackage.isSafetyRelevant', 'true'),
  ('b49d7660-1625-5d9f-9441-2f04aaea7cea', 'f7295603-6af8-549f-b101-5d8e1625f062', 'RadiologicalInventory.inventoryId', 'INV-RPV-A-2026'),
  ('85551e6f-c3a1-5fdf-b0fb-c08edab76036', 'f7295603-6af8-549f-b101-5d8e1625f062', 'RadiologicalInventory.referenceDate', '2026-01-31'),
  ('bb7369bb-90e7-54b4-a10f-4097b805213f', 'f7295603-6af8-549f-b101-5d8e1625f062', 'RadiologicalInventory.dominantNuclide', 'Co-60'),
  ('67f46b1d-f075-5e3a-a83a-ee86792f5336', 'f7295603-6af8-549f-b101-5d8e1625f062', 'RadiologicalInventory.totalActivityGBq', '780'),
  ('77e6c81a-4f80-5c2d-bbda-6c0749964cd7', 'f7295603-6af8-549f-b101-5d8e1625f062', 'RadiologicalInventory.uncertaintyPercent', '18'),
  ('9e415342-4caa-5daf-a463-7393599bee48', 'eeebfa24-2d04-507a-a4c6-b854d92d454e', 'ContaminationZone.zoneId', 'RC-1'),
  ('1efb2c1a-85b7-56bc-8721-deefe72fefdb', 'eeebfa24-2d04-507a-a4c6-b854d92d454e', 'ContaminationZone.radiologicalCategory', 'high contamination zone'),
  ('8588b04f-1003-5c0b-a19b-6419be1b8c06', '544ddd92-c905-5567-a53d-e9fd845e0797', 'SafetyMeasure.measureId', 'SM-UNDERWATER-CUTTING'),
  ('676f4b9e-fe41-5cc1-bcfe-3c5033ac3da0', '544ddd92-c905-5567-a53d-e9fd845e0797', 'SafetyMeasure.measureName', 'underwater cutting with local filtration and shielded tooling'),
  ('be23e265-fc13-58cf-ad36-8b65af4f072f', '544ddd92-c905-5567-a53d-e9fd845e0797', 'SafetyMeasure.measureType', 'technical'),
  ('d78e066f-b625-51ac-aa3f-b13ef3d6a00a', '544ddd92-c905-5567-a53d-e9fd845e0797', 'SafetyMeasure.isMandatory', 'true'),
  ('bc022e66-6430-5551-86fd-2af31d3616f4', '94db59ab-2f06-5623-a34c-2649dfb3068c', 'DoseConstraint.constraintCode', 'DC-WORKER-20'),
  ('21630b35-1a5d-590c-aefe-37e78ccab6c6', '94db59ab-2f06-5623-a34c-2649dfb3068c', 'DoseConstraint.annualDoseLimitMSv', '20'),
  ('74c1fc06-d6fe-57b8-9d9f-dd0ca257619a', '94db59ab-2f06-5623-a34c-2649dfb3068c', 'DoseConstraint.personGroup', 'affected work group'),
  ('261f57b1-6b6c-5286-863b-d569ba37f2ed', 'cfb1d293-8055-5e66-ac89-14f874a4ddf2', 'MonitoringProgram.programId', 'MP-RC1'),
  ('f654447c-03cd-5fe4-b3fd-c2437a496f3d', 'cfb1d293-8055-5e66-ac89-14f874a4ddf2', 'MonitoringProgram.frequency', 'continuous dose rate monitoring and daily contamination checks'),
  ('81ef5add-9bc4-56b6-bb35-c843498a79dc', 'cfb1d293-8055-5e66-ac89-14f874a4ddf2', 'MonitoringProgram.responsibleTeam', 'Radiation Protection Team'),
  ('1e81ae70-3a50-53fc-9964-a7659f017ae6', '630ecc97-8ab2-5f89-ace1-438370ce0586', 'WasteStream.streamId', 'WS-AM-240'),
  ('b7dbdb7b-a1c3-571c-8e08-6668407ab429', '630ecc97-8ab2-5f89-ace1-438370ce0586', 'WasteStream.wasteCategory', 'activated metal'),
  ('eda18e68-0fd1-5d5e-abdd-47412c017a55', '630ecc97-8ab2-5f89-ace1-438370ce0586', 'WasteStream.estimatedMassTonnes', '42'),
  ('de5e418c-6165-5b75-9ed9-5deab6b6eaff', '630ecc97-8ab2-5f89-ace1-438370ce0586', 'WasteStream.requiresConditioning', 'true'),
  ('5392eeaf-421b-5de4-bc22-52a8779fb4be', '1a97e4ab-8a2a-50e7-ad8b-c886b8d925a5', 'WastePackage.packageId', 'WP-AM-001'),
  ('07abeaca-2f31-5adc-a9bd-2edb54823006', '1a97e4ab-8a2a-50e7-ad8b-c886b8d925a5', 'WastePackage.packageType', 'shielded box'),
  ('5e87c283-b0df-599f-b39c-93f3800fdce6', '1a97e4ab-8a2a-50e7-ad8b-c886b8d925a5', 'WastePackage.grossMassTonnes', '8.5'),
  ('82f08b90-d287-5540-a4ee-6bf125297be4', '1a97e4ab-8a2a-50e7-ad8b-c886b8d925a5', 'WastePackage.isConditioned', 'true'),
  ('d9ce1f4d-b23c-5c3c-a900-9588c9db7301', 'b82a9caf-6b08-587b-9271-badb053ac106', 'ClearanceMeasurement.measurementId', 'CM-AM-001'),
  ('d89ffc4b-e52e-541e-9f5d-6991cfec1528', 'b82a9caf-6b08-587b-9271-badb053ac106', 'ClearanceMeasurement.measurementDate', '2026-08-14'),
  ('1759b913-eb35-5888-85ee-e8bb2b2bcb18', 'b82a9caf-6b08-587b-9271-badb053ac106', 'ClearanceMeasurement.method', 'gamma spectrometry'),
  ('4d893665-f393-58e0-a674-74e5a1228cbb', 'b82a9caf-6b08-587b-9271-badb053ac106', 'ClearanceMeasurement.passed', 'false'),
  ('1a6d6e99-d452-5061-8a58-9b5126e2577b', '9cbc6ab6-c3f1-51c0-b66f-9a896173b72b', 'DisposalFacility.disposalFacilityId', 'ZL-Beta'),
  ('1c820abe-905b-5d8d-8e43-5f32471b27a9', '9cbc6ab6-c3f1-51c0-b66f-9a896173b72b', 'DisposalFacility.disposalFacilityName', 'Central interim storage facility ZL-Beta'),
  ('21649fe7-71e4-5785-b528-de5cec0f3f65', '9cbc6ab6-c3f1-51c0-b66f-9a896173b72b', 'DisposalFacility.country', 'Germany'),
  ('fba326b5-aa0c-5c87-aa1c-53f5e818ab03', '0c918b47-cfdf-5210-9fc7-52780af2b2ea', 'TransportCampaign.campaignId', 'TC-AM-2026-01'),
  ('ce65b526-afd0-5ee9-bbd6-ae8370390771', '0c918b47-cfdf-5210-9fc7-52780af2b2ea', 'TransportCampaign.transportMode', 'road'),
  ('c00eb4d2-8023-525b-810d-9f9b65fc0630', '0c918b47-cfdf-5210-9fc7-52780af2b2ea', 'TransportCampaign.isApproved', 'true');

INSERT INTO evidence_anchors (id, document_id, section_id, paragraph_id, quote_text, context_text, page_from, page_to) VALUES
  ('f4dfe74b-b3e7-5b5c-b02c-eda856e185cd', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '581d24ac-85b9-5894-9b96-f8fba5773f4c', '6d35244a-0f81-5cd5-b98d-4dcacdfc2d51', 'The KBR Unit A Decommissioning Project targets the Kernkraftwerk Beispielrhein facility', '1. Facility Overview', 1, 1),
  ('0b488541-f6f0-5861-a312-2545ce4d3141', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '581d24ac-85b9-5894-9b96-f8fba5773f4c', '6d35244a-0f81-5cd5-b98d-4dcacdfc2d51', 'focuses on Reactor Unit A', '1. Facility Overview', 1, 1),
  ('f4885786-8caa-5f94-b478-fb72c698a366', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '4c680350-ea00-5760-b57f-824592428988', 'c4249473-bd3a-5220-93f7-a210a7c67595', 'The reactor building RB-A contains the reactor cavity, the primary circuit work areas, and the RPV internals', '2. Asset Boundary and Components', 2, 2),
  ('f156378c-6981-568b-9b44-3f5ea8b25139', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '8e721495-32b9-572d-932a-cc8ccd0f223f', '557ad0dc-44a9-5686-bf46-f88ca26e878d', 'AtG §7(3) is cited as the legal basis for authorization of decommissioning and dismantling of the licensed installation', '3. Legal Basis', 3, 4),
  ('cfc429e2-d66c-592d-8eb4-101d3a59c925', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'eaa9f498-420f-59b9-80e8-9ed3f26cdbdf', '3070ab21-c7a2-5b15-b566-d9021cf56e41', 'The Nuclear Supervisory Authority NRW issued Permit KBR-DEC-2026-01', '5. Regulatory Authority and Reporting', 5, 5),
  ('daf7e32d-5bc5-5db9-bab0-bf8a88f64ca6', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'bacea2c3-39a8-5f44-b5d0-75d8e268be31', '46bf5a01-56a3-5a7b-acd5-855c5504195f', 'The permit applies to the KBR Unit A Decommissioning Project', '4. Decommissioning Permit', 4, 4),
  ('c4804059-b5de-54ed-8117-ee96b92a05ed', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'bacea2c3-39a8-5f44-b5d0-75d8e268be31', '46bf5a01-56a3-5a7b-acd5-855c5504195f', 'explicitly approves the underwater segmentation of RPV internals after authority review of the detailed work package', '4. Decommissioning Permit', 4, 7),
  ('7b4d68e2-f1b5-5578-96e0-01e4168b491e', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'eaa9f498-420f-59b9-80e8-9ed3f26cdbdf', 'f5be63fc-abe4-57b1-a2e5-f5d16e0051ba', 'The permit requires quarterly monitoring reports', '5. Regulatory Authority and Reporting', 5, 5),
  ('c3285099-f4cc-5f69-9c1b-ce0318bc8ef9', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'eaa9f498-420f-59b9-80e8-9ed3f26cdbdf', 'f5be63fc-abe4-57b1-a2e5-f5d16e0051ba', 'Report REP-MP-RC1-Q3-2026 documents monitoring program MP-RC1', '5. Regulatory Authority and Reporting', 5, 10),
  ('aa2e0652-0efe-553e-bfac-b1d70bdd12c6', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '1a507940-b644-5fa3-9276-b5c1aad8a850', 'c5e81aa4-cd34-547e-824c-c8df4b9ba2cd', 'Phase P2 Reactor Internals Segmentation', '6. Project Phases and Milestones', 6, 6),
  ('075a7ed7-0321-5b34-8614-8a5cb07b1566', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '1a507940-b644-5fa3-9276-b5c1aad8a850', 'c5e81aa4-cd34-547e-824c-c8df4b9ba2cd', 'Phase P2 Reactor Internals Segmentation includes Step ST-240 Underwater segmentation of RPV internals', '6. Project Phases and Milestones', 6, 6),
  ('c80d72a5-9565-5668-b062-c853c631c4ab', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'de15888f-3953-5bec-a872-48e8a9425b99', '2b668343-0471-5319-bd54-c7b845793198', 'Step ST-240 Underwater segmentation of RPV internals is planned and depends on Step ST-010', '7. Step Dependencies and Work Packages', 7, 7),
  ('43ea22a7-6da2-54a4-b3d1-fbe770b8d100', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'de15888f-3953-5bec-a872-48e8a9425b99', '81e247cd-cae0-5836-b162-65ed7304d8fe', 'Work package WP-240-CUT defines shielded underwater cutting', '7. Step Dependencies and Work Packages', 7, 7),
  ('5aca7b78-2fc4-5863-85e2-7478279112e4', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '394404ad-906f-57fe-8a5c-d21611889793', '31a63d1d-ce74-5513-8feb-9891194eee6b', 'Radiological inventory INV-RPV-A-2026 characterizes the RPV internals', '8. Radiological Characterization', 8, 8),
  ('d33e2691-044b-55fd-b6cf-7a35aa1b635c', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '394404ad-906f-57fe-8a5c-d21611889793', 'bb177c22-049c-5057-9aea-b05005f8d339', 'The RPV internals are located in contamination zone RC-1', '8. Radiological Characterization', 8, 8),
  ('9698dd69-17ba-5d33-9d67-cc1a3578fe38', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'acf3a197-4528-5c2f-a6cb-a2384c14772e', '09e1d8d1-2fa7-5c52-bfd0-a8135216ce54', 'Step ST-240 requires safety measure SM-UNDERWATER-CUTTING before work starts', '9. Safety Measures and Dose Constraints', 9, 9),
  ('4f501f12-9cbb-53b9-915f-b2b688b5d022', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'acf3a197-4528-5c2f-a6cb-a2384c14772e', '74bfd2d9-4c8b-5b88-93c7-f1360adf3e28', 'The same step is subject to dose constraint DC-WORKER-20', '9. Safety Measures and Dose Constraints', 9, 9),
  ('ef96de39-c158-5b5c-aff6-c776b00c6414', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '79b49381-09bd-5a19-861f-039145729c9f', '4ea73be6-8322-556d-ab77-0375295527d7', 'Monitoring program MP-RC1 observes contamination zone RC-1', '10. Monitoring Program', 10, 10),
  ('d1b915d0-225e-5354-8997-e9e2072e52b9', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '2c6b5f85-51e7-5455-9a20-0e64dc5c0da9', '00afd5bc-8ab8-5527-ab6c-fb4c2cef9840', 'Step ST-240 Underwater segmentation of RPV internals generates waste stream WS-AM-240', '11. Waste Generation and Packaging', 11, 11),
  ('451cae67-00ab-5dc9-aeda-7a03db2fbc11', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '2c6b5f85-51e7-5455-9a20-0e64dc5c0da9', '7582467d-13f5-589b-97d9-e4aa7310748c', 'Waste stream WS-AM-240 is packed in waste package WP-AM-001', '11. Waste Generation and Packaging', 11, 11),
  ('f7b7bf5d-68a3-597d-8037-fdaffca4e259', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '1f763abd-819e-5fd0-a5d3-a0e54f0fd9da', 'd6e13d23-8a90-55ed-b6ae-bb005617486c', 'Waste package WP-AM-001 requires clearance measurement CM-AM-001', '12. Clearance, Transport, and Disposal', 12, 12),
  ('ccca18bd-0604-5933-85e8-834f19df58bb', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '1f763abd-819e-5fd0-a5d3-a0e54f0fd9da', 'd6e13d23-8a90-55ed-b6ae-bb005617486c', 'The measurement uses gamma spectrometry and did not pass the unrestricted release criterion', '12. Clearance, Transport, and Disposal', 12, 12),
  ('eab2d154-777d-51bb-b50d-14fed29435eb', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '1f763abd-819e-5fd0-a5d3-a0e54f0fd9da', 'fbf145c3-0160-534c-b9ee-a6af0beed984', 'WP-AM-001 is assigned to the Central interim storage facility ZL-Beta in Germany', '12. Clearance, Transport, and Disposal', 12, 12),
  ('05a5052a-edf6-57c7-be51-d747e9239e54', '95838bcc-6871-5b9c-af53-baeb9a8a535d', '1f763abd-819e-5fd0-a5d3-a0e54f0fd9da', 'fbf145c3-0160-534c-b9ee-a6af0beed984', 'Transport campaign TC-AM-2026-01 moves WP-AM-001 by road after route approval', '12. Clearance, Transport, and Disposal', 12, 12);

INSERT INTO facts (id, extraction_run_id, document_id, subject_text, relation_text, object_text, subject_entity_id, object_entity_id, relation_type_id, confidence, review_status, is_cross_chapter, primary_anchor_id) VALUES
  ('8a4a7224-e995-5cd3-b6db-ce352bc7fc3a', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'KBR Unit A Decommissioning Project', 'targets', 'Kernkraftwerk Beispielrhein (KBR)', '89697a05-e78d-5f9c-b7d9-0beac16be3b0', 'ea5135b8-f0d9-5538-be96-f4c97b133251', 'projectTargetsFacility', 0.98, 'pending', false, 'f4dfe74b-b3e7-5b5c-b02c-eda856e185cd'),
  ('45d29bfb-3fb0-50cc-b5b0-b1782141524b', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Kernkraftwerk Beispielrhein (KBR)', 'has unit', 'Reactor Unit A', 'ea5135b8-f0d9-5538-be96-f4c97b133251', '605c6207-ee25-5e33-b7d3-aada4fd9c81b', 'facilityHasUnit', 0.9, 'pending', false, '0b488541-f6f0-5861-a312-2545ce4d3141'),
  ('d137c753-02af-5bd6-bd72-4cf95388c139', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'RPV internals of Unit A', 'located in building', 'reactor building RB-A', '1027fffa-39cc-5d6c-89a7-636f26134e32', 'd88a8aae-8d09-5388-8d99-124511424f09', 'componentLocatedInBuilding', 0.88, 'pending', false, 'f4885786-8caa-5f94-b478-fb72c698a366'),
  ('0e97a6e7-0e0d-599d-a629-398330edebde', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'AtG §7(3)', 'constrains', 'Permit KBR-DEC-2026-01', '91100fea-db32-57fc-9ede-5f416f1b322f', '1481f9c3-b650-52ed-815c-27373a818d20', 'legalRequirementConstrainsPermit', 0.92, 'pending', true, 'f156378c-6981-568b-9b44-3f5ea8b25139'),
  ('2dc83868-1fc8-572c-a706-a4a92e1ac7a9', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Permit KBR-DEC-2026-01', 'issued by', 'Nuclear Supervisory Authority NRW', '1481f9c3-b650-52ed-815c-27373a818d20', 'ebbd4c9d-03a4-5a36-b1a7-fd7a70cc1ded', 'permitIssuedByAuthority', 0.99, 'pending', false, 'cfc429e2-d66c-592d-8eb4-101d3a59c925'),
  ('e2b4b2b5-9f4c-5cec-b668-09619cadf9fa', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Permit KBR-DEC-2026-01', 'applies to', 'KBR Unit A Decommissioning Project', '1481f9c3-b650-52ed-815c-27373a818d20', '89697a05-e78d-5f9c-b7d9-0beac16be3b0', 'permitAppliesToProject', 0.95, 'pending', false, 'daf7e32d-5bc5-5db9-bab0-bf8a88f64ca6'),
  ('baf13178-50e2-581a-8fcc-5bee9948574b', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Permit KBR-DEC-2026-01', 'approves', 'Step ST-240 Underwater segmentation of RPV internals', '1481f9c3-b650-52ed-815c-27373a818d20', 'dd60a0cd-0942-5b13-9c09-9a392abcaec5', 'permitApprovesStep', 0.93, 'pending', true, 'c4804059-b5de-54ed-8117-ee96b92a05ed'),
  ('622b5619-6be6-5083-a687-542165c5db95', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Permit KBR-DEC-2026-01', 'requires', 'Report REP-MP-RC1-Q3-2026', '1481f9c3-b650-52ed-815c-27373a818d20', '33b7fbe1-85b6-55a7-9944-c11b4f8204a8', 'permitRequiresReport', 0.9, 'pending', false, '7b4d68e2-f1b5-5578-96e0-01e4168b491e'),
  ('30f6e29c-134d-5723-853e-4711d8381d50', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Report REP-MP-RC1-Q3-2026', 'documents', 'Monitoring program MP-RC1', '33b7fbe1-85b6-55a7-9944-c11b4f8204a8', 'cfb1d293-8055-5e66-ac89-14f874a4ddf2', 'reportDocumentsMonitoringProgram', 0.96, 'pending', true, 'c3285099-f4cc-5f69-9c1b-ce0318bc8ef9'),
  ('6827803b-a29c-5f6a-bc52-8d5c67c7e5d3', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'KBR Unit A Decommissioning Project', 'has phase', 'Phase P2 Reactor Internals Segmentation', '89697a05-e78d-5f9c-b7d9-0beac16be3b0', '7dcfe1ee-a338-5775-9ae5-e336261bdec1', 'projectHasPhase', 0.91, 'pending', false, 'aa2e0652-0efe-553e-bfac-b1d70bdd12c6'),
  ('bc9d1c59-5bf5-507e-aa05-839d3a741d08', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Phase P2 Reactor Internals Segmentation', 'includes', 'Step ST-240 Underwater segmentation of RPV internals', '7dcfe1ee-a338-5775-9ae5-e336261bdec1', 'dd60a0cd-0942-5b13-9c09-9a392abcaec5', 'phaseIncludesStep', 0.97, 'pending', false, '075a7ed7-0321-5b34-8614-8a5cb07b1566'),
  ('751b4643-c90b-59bc-aa97-e6b3ee245b6d', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Step ST-240 Underwater segmentation of RPV internals', 'depends on', 'Step ST-010 Fuel removal verification', 'dd60a0cd-0942-5b13-9c09-9a392abcaec5', '92bff7ee-4832-5cd6-add8-9995269f3630', 'stepDependsOnStep', 0.98, 'pending', false, 'c80d72a5-9565-5668-b062-c853c631c4ab'),
  ('38fff81d-ab1e-5eed-954b-56dd227f536e', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Step ST-240 Underwater segmentation of RPV internals', 'has work package', 'Work package WP-240-CUT', 'dd60a0cd-0942-5b13-9c09-9a392abcaec5', '4541cf68-6a81-52b5-8ab8-76820d6be6cb', 'stepHasWorkPackage', 0.93, 'pending', false, '43ea22a7-6da2-54a4-b3d1-fbe770b8d100'),
  ('c7fd3176-0dea-553b-8919-4946218216ac', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Inventory INV-RPV-A-2026', 'characterizes', 'RPV internals of Unit A', 'f7295603-6af8-549f-b101-5d8e1625f062', '1027fffa-39cc-5d6c-89a7-636f26134e32', 'inventoryCharacterizesComponent', 0.99, 'pending', false, '5aca7b78-2fc4-5863-85e2-7478279112e4'),
  ('7ab3c694-fcfb-538d-bd15-100d7a1a0363', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'RPV internals of Unit A', 'located in zone', 'Zone RC-1 Reactor cavity wet work area', '1027fffa-39cc-5d6c-89a7-636f26134e32', 'eeebfa24-2d04-507a-a4c6-b854d92d454e', 'componentLocatedInZone', 0.94, 'pending', false, 'd33e2691-044b-55fd-b6cf-7a35aa1b635c'),
  ('0b4ecb89-0041-5dab-9519-75a91119f599', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Step ST-240 Underwater segmentation of RPV internals', 'requires', 'Safety measure SM-UNDERWATER-CUTTING', 'dd60a0cd-0942-5b13-9c09-9a392abcaec5', '544ddd92-c905-5567-a53d-e9fd845e0797', 'stepRequiresSafetyMeasure', 0.98, 'pending', false, '9698dd69-17ba-5d33-9d67-cc1a3578fe38'),
  ('3e29b006-8112-598b-8143-94e0705a0b24', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Step ST-240 Underwater segmentation of RPV internals', 'subject to', 'dose constraint DC-WORKER-20', 'dd60a0cd-0942-5b13-9c09-9a392abcaec5', '94db59ab-2f06-5623-a34c-2649dfb3068c', 'stepSubjectToDoseConstraint', 0.94, 'pending', true, '4f501f12-9cbb-53b9-915f-b2b688b5d022'),
  ('135cc4e9-4998-5ae3-a9ed-c4e13cc347e5', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Monitoring program MP-RC1', 'observes', 'Zone RC-1 Reactor cavity wet work area', 'cfb1d293-8055-5e66-ac89-14f874a4ddf2', 'eeebfa24-2d04-507a-a4c6-b854d92d454e', 'monitoringProgramObservesZone', 0.99, 'pending', false, 'ef96de39-c158-5b5c-aff6-c776b00c6414'),
  ('706a3a3f-76d2-562f-b116-e578285a69b3', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Step ST-240 Underwater segmentation of RPV internals', 'generates', 'Waste stream WS-AM-240 activated metal from RPV internals segmentation', 'dd60a0cd-0942-5b13-9c09-9a392abcaec5', '630ecc97-8ab2-5f89-ace1-438370ce0586', 'stepGeneratesWasteStream', 0.99, 'pending', false, 'd1b915d0-225e-5354-8997-e9e2072e52b9'),
  ('2641c00d-0193-5336-a06f-05ed50a400cc', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Waste stream WS-AM-240 activated metal from RPV internals segmentation', 'packed in', 'Waste package WP-AM-001', '630ecc97-8ab2-5f89-ace1-438370ce0586', '1a97e4ab-8a2a-50e7-ad8b-c886b8d925a5', 'wasteStreamPackedInPackage', 0.97, 'pending', false, '451cae67-00ab-5dc9-aeda-7a03db2fbc11'),
  ('c95eb4f3-3b9b-5106-a3aa-5243de144b5e', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Waste package WP-AM-001', 'requires', 'Clearance measurement CM-AM-001', '1a97e4ab-8a2a-50e7-ad8b-c886b8d925a5', 'b82a9caf-6b08-587b-9271-badb053ac106', 'packageRequiresClearanceMeasurement', 0.99, 'pending', false, 'f7b7bf5d-68a3-597d-8037-fdaffca4e259'),
  ('3f9b3a96-9a57-5124-bf5c-93ad9024e5b8', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Clearance measurement CM-AM-001', 'supports release', 'Waste package WP-AM-001', 'b82a9caf-6b08-587b-9271-badb053ac106', '1a97e4ab-8a2a-50e7-ad8b-c886b8d925a5', 'clearanceMeasurementSupportsRelease', 0.83, 'pending', false, 'ccca18bd-0604-5933-85e8-834f19df58bb'),
  ('adcafea1-c077-5b6f-9634-54c37069f2f5', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Waste package WP-AM-001', 'transported to', 'Central interim storage facility ZL-Beta in Germany', '1a97e4ab-8a2a-50e7-ad8b-c886b8d925a5', '9cbc6ab6-c3f1-51c0-b66f-9a896173b72b', 'packageTransportedToDisposalFacility', 0.95, 'pending', false, 'eab2d154-777d-51bb-b50d-14fed29435eb'),
  ('8cda3674-31dc-5046-8deb-7aaeb2384544', 'fd61693c-3f7e-5597-980b-1e69fdb768a0', '95838bcc-6871-5b9c-af53-baeb9a8a535d', 'Transport campaign TC-AM-2026-01', 'moves', 'Waste package WP-AM-001', '0c918b47-cfdf-5210-9fc7-52780af2b2ea', '1a97e4ab-8a2a-50e7-ad8b-c886b8d925a5', 'transportCampaignMovesPackage', 0.95, 'pending', false, '05a5052a-edf6-57c7-be51-d747e9239e54');

INSERT INTO fact_anchors (fact_id, anchor_id) VALUES
  ('8a4a7224-e995-5cd3-b6db-ce352bc7fc3a', 'f4dfe74b-b3e7-5b5c-b02c-eda856e185cd'),
  ('45d29bfb-3fb0-50cc-b5b0-b1782141524b', '0b488541-f6f0-5861-a312-2545ce4d3141'),
  ('d137c753-02af-5bd6-bd72-4cf95388c139', 'f4885786-8caa-5f94-b478-fb72c698a366'),
  ('0e97a6e7-0e0d-599d-a629-398330edebde', 'f156378c-6981-568b-9b44-3f5ea8b25139'),
  ('2dc83868-1fc8-572c-a706-a4a92e1ac7a9', 'cfc429e2-d66c-592d-8eb4-101d3a59c925'),
  ('e2b4b2b5-9f4c-5cec-b668-09619cadf9fa', 'daf7e32d-5bc5-5db9-bab0-bf8a88f64ca6'),
  ('baf13178-50e2-581a-8fcc-5bee9948574b', 'c4804059-b5de-54ed-8117-ee96b92a05ed'),
  ('622b5619-6be6-5083-a687-542165c5db95', '7b4d68e2-f1b5-5578-96e0-01e4168b491e'),
  ('30f6e29c-134d-5723-853e-4711d8381d50', 'c3285099-f4cc-5f69-9c1b-ce0318bc8ef9'),
  ('6827803b-a29c-5f6a-bc52-8d5c67c7e5d3', 'aa2e0652-0efe-553e-bfac-b1d70bdd12c6'),
  ('bc9d1c59-5bf5-507e-aa05-839d3a741d08', '075a7ed7-0321-5b34-8614-8a5cb07b1566'),
  ('751b4643-c90b-59bc-aa97-e6b3ee245b6d', 'c80d72a5-9565-5668-b062-c853c631c4ab'),
  ('38fff81d-ab1e-5eed-954b-56dd227f536e', '43ea22a7-6da2-54a4-b3d1-fbe770b8d100'),
  ('c7fd3176-0dea-553b-8919-4946218216ac', '5aca7b78-2fc4-5863-85e2-7478279112e4'),
  ('7ab3c694-fcfb-538d-bd15-100d7a1a0363', 'd33e2691-044b-55fd-b6cf-7a35aa1b635c'),
  ('0b4ecb89-0041-5dab-9519-75a91119f599', '9698dd69-17ba-5d33-9d67-cc1a3578fe38'),
  ('3e29b006-8112-598b-8143-94e0705a0b24', '4f501f12-9cbb-53b9-915f-b2b688b5d022'),
  ('135cc4e9-4998-5ae3-a9ed-c4e13cc347e5', 'ef96de39-c158-5b5c-aff6-c776b00c6414'),
  ('706a3a3f-76d2-562f-b116-e578285a69b3', 'd1b915d0-225e-5354-8997-e9e2072e52b9'),
  ('2641c00d-0193-5336-a06f-05ed50a400cc', '451cae67-00ab-5dc9-aeda-7a03db2fbc11'),
  ('c95eb4f3-3b9b-5106-a3aa-5243de144b5e', 'f7b7bf5d-68a3-597d-8037-fdaffca4e259'),
  ('3f9b3a96-9a57-5124-bf5c-93ad9024e5b8', 'ccca18bd-0604-5933-85e8-834f19df58bb'),
  ('adcafea1-c077-5b6f-9634-54c37069f2f5', 'eab2d154-777d-51bb-b50d-14fed29435eb'),
  ('8cda3674-31dc-5046-8deb-7aaeb2384544', '05a5052a-edf6-57c7-be51-d747e9239e54');

