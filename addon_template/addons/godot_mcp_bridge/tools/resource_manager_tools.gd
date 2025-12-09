extends RefCounted

var editor_interface: EditorInterface

# Response dictionary keys
const KEY_SUCCESS = "success"
const KEY_ERROR = "error"
const KEY_PATH = "path"
const KEY_COUNT = "count"
const KEY_MESSAGE = "message"
const KEY_RESOURCES = "resources"
const KEY_DIRECTORY = "directory"
const KEY_FILTER_TYPE = "filter_type"
const KEY_RESOURCE_TYPE = "resource_type"
const KEY_PROPERTY = "property"
const KEY_VALUE = "value"
const KEY_PROPERTIES = "properties"
const KEY_PROPERTY_COUNT = "property_count"
const KEY_FILE_SIZE = "file_size"
const KEY_IS_BUILT_IN = "is_built_in"
const KEY_SOURCE_PATH = "source_path"
const KEY_DESTINATION_PATH = "destination_path"

func list_resource_files(args: Dictionary) -> Dictionary:
	var directory: String = args.get("directory", "res://")
	var filter_type: String = args.get("filter_type", "")

	var resources: Array = []
	var dir = DirAccess.open(directory)

	if not dir:
		return _error_response("Failed to open directory: " + directory)

	_scan_resource_files(dir, directory, filter_type, resources)

	return _success_response({
		KEY_DIRECTORY: directory,
		KEY_FILTER_TYPE: filter_type,
		KEY_COUNT: len(resources),
		KEY_RESOURCES: resources
	})

func get_resource_info(args: Dictionary) -> Dictionary:
	var validation_error: String = _validate_required_params(args, ["path"])
	if not validation_error.is_empty():
		return _error_response(validation_error)

	var path: String = args.path

	if not ResourceLoader.exists(path):
		return _error_response("Resource not found: " + path)

	var resource = _load_resource(path)
	if resource == null:
		return _error_response("Failed to load resource: " + path)

	var file_access = FileAccess.open(path, FileAccess.READ)
	var file_size: int = 0
	if file_access:
		file_size = file_access.get_length()

	return _success_response({
		KEY_PATH: path,
		KEY_RESOURCE_TYPE: resource.get_class(),
		KEY_FILE_SIZE: file_size,
		KEY_IS_BUILT_IN: path.contains("::")
	})

func get_resource_properties(args: Dictionary) -> Dictionary:
	var validation_error: String = _validate_required_params(args, ["path"])
	if not validation_error.is_empty():
		return _error_response(validation_error)

	var path: String = args.path

	if not ResourceLoader.exists(path):
		return _error_response("Resource not found: " + path)

	var resource = _load_resource(path)
	if resource == null:
		return _error_response("Failed to load resource: " + path)

	var properties: Array = []

	for prop in resource.get_property_list():
		if prop.name.begins_with("_"):
			continue

		if prop.name == "script":
			continue

		var value = resource.get(prop.name)
		properties.append({
			"name": prop.name,
			"value": value,
			"type": typeof(value)
		})

	return _success_response({
		KEY_PATH: path,
		KEY_RESOURCE_TYPE: resource.get_class(),
		KEY_PROPERTY_COUNT: len(properties),
		KEY_PROPERTIES: properties
	})

func set_resource_property(args: Dictionary) -> Dictionary:
	var validation_error: String = _validate_required_params(args, ["path", "property", "value"])
	if not validation_error.is_empty():
		return _error_response(validation_error)

	var path: String = args.path
	var property: String = args.property
	var value = args.value

	if not ResourceLoader.exists(path):
		return _error_response("Resource not found: " + path)

	var resource = _load_resource(path)
	if resource == null:
		return _error_response("Failed to load resource: " + path)

	if not property in resource:
		return _error_response("Property not found on resource: " + property)

	resource.set(property, value)

	var save_result = ResourceSaver.save(resource, path)
	if save_result != OK:
		return _error_response("Failed to save resource: " + error_string(save_result))

	return _success_response({
		KEY_PATH: path,
		KEY_PROPERTY: property,
		KEY_VALUE: value,
		KEY_MESSAGE: "Resource property updated and saved"
	})

func create_resource(args: Dictionary) -> Dictionary:
	var validation_error: String = _validate_required_params(args, ["type", "path"])
	if not validation_error.is_empty():
		return _error_response(validation_error)

	var resource_type: String = args.type
	var path: String = args.path

	if ResourceLoader.exists(path):
		return _error_response("Resource already exists at path: " + path)

	var resource: Resource

	match resource_type:
		"Resource":
			resource = Resource.new()
		_:
			resource = ClassDB.instantiate(resource_type)

	if resource == null:
		var script = _find_and_load_script(resource_type)
		if script:
			resource = script.new()

	if resource == null:
		return _error_response("Failed to instantiate resource type: " + resource_type)

	var save_result = ResourceSaver.save(resource, path)
	if save_result != OK:
		return _error_response("Failed to save resource: " + error_string(save_result))

	return _success_response({
		KEY_PATH: path,
		KEY_RESOURCE_TYPE: resource_type,
		KEY_MESSAGE: "Resource created and saved"
	})

func delete_resource(args: Dictionary) -> Dictionary:
	var validation_error: String = _validate_required_params(args, ["path"])
	if not validation_error.is_empty():
		return _error_response(validation_error)

	var path: String = args.path

	if not ResourceLoader.exists(path):
		return _error_response("Resource not found: " + path)

	var dir = DirAccess.open(path.get_base_dir())
	if dir == null:
		return _error_response("Failed to access directory for resource")

	var filename: String = path.get_file()
	var result = dir.remove(filename)

	if result != OK:
		return _error_response("Failed to delete resource: " + error_string(result))

	return _success_response({
		KEY_PATH: path,
		KEY_MESSAGE: "Resource deleted"
	})

func duplicate_resource(args: Dictionary) -> Dictionary:
	var validation_error: String = _validate_required_params(args, ["source_path", "destination_path"])
	if not validation_error.is_empty():
		return _error_response(validation_error)

	var source_path: String = args.source_path
	var dest_path: String = args.destination_path

	if not ResourceLoader.exists(source_path):
		return _error_response("Source resource not found: " + source_path)

	if ResourceLoader.exists(dest_path):
		return _error_response("Destination resource already exists: " + dest_path)

	var resource = _load_resource(source_path)
	if resource == null:
		return _error_response("Failed to load source resource: " + source_path)

	var duplicated = resource.duplicate()
	if duplicated == null:
		return _error_response("Failed to duplicate resource")

	var save_result = ResourceSaver.save(duplicated, dest_path)
	if save_result != OK:
		return _error_response("Failed to save duplicated resource: " + error_string(save_result))

	return _success_response({
		KEY_SOURCE_PATH: source_path,
		KEY_DESTINATION_PATH: dest_path,
		KEY_MESSAGE: "Resource duplicated"
	})

func _scan_resource_files(dir: DirAccess, path: String, filter_type: String, resources: Array) -> void:
	"""Recursively scan directory for resource files."""
	dir.list_dir_begin()
	var file_name: String = dir.get_next()

	if not path.ends_with("/"):
		path = path + "/"

	while file_name != "":
		if file_name.begins_with("."):
			file_name = dir.get_next()
			continue

		var full_path: String = path + file_name

		if dir.current_is_dir():
			var subdir = DirAccess.open(full_path)
			if subdir:
				_scan_resource_files(subdir, full_path, filter_type, resources)
		else:
			var ext: String = file_name.get_extension().to_lower()

			if ext in ["tres", "res"]:
				if filter_type.is_empty() or ext == filter_type:
					var resource_type: String = ""
					var res = ResourceLoader.load(full_path)
					if res != null:
						resource_type = res.get_class()

					resources.append({
						"name": file_name,
						"path": full_path,
						"extension": ext,
						"resource_type": resource_type
					})

		file_name = dir.get_next()

	dir.list_dir_end()

func _find_and_load_script(a_class_name: String) -> Variant:
	var global_classes = ProjectSettings.get_global_class_list()
	for class_info in global_classes:
		if class_info.get("class") == a_class_name:
			var script_path = class_info.get("path")
			if script_path:
				return ResourceLoader.load(script_path)
	return null

func _validate_required_params(args: Dictionary, required: Array) -> String:
	"""Validate that all required parameters are present. Returns empty string if valid."""
	for param in required:
		if not args.has(param):
			return "Missing required parameter: " + param
	return ""

func _load_resource(path: String) -> Resource:
	"""Load a resource and return it, or null if it fails. Assumes ResourceLoader.exists() was already checked."""
	var resource = ResourceLoader.load(path)
	if resource == null:
		return null
	return resource

func _error_response(message: String) -> Dictionary:
	"""Create a standard error response."""
	return {KEY_ERROR: message}

func _success_response(data: Dictionary = {}) -> Dictionary:
	"""Create a standard success response with optional additional data."""
	var response = {KEY_SUCCESS: true}
	response.merge(data)
	return response
